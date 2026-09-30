import type { TableClient } from "@azure/data-tables";
import {
  AzureTableFeedbackStorage,
  FeedbackNotFoundError,
  InMemoryFeedbackStorage,
  InvalidTransitionError,
  seedStorage,
} from "../src/server/storage.js";

const input = {
  title: "Useful workshop",
  description: "Keep the live walkthrough.",
  category: "facilitation" as const,
  displayName: "Grace",
};

describe("in-memory feedback storage", () => {
  it("creates and lists newest feedback first", async () => {
    const storage = new InMemoryFeedbackStorage();
    await storage.create(input, {
      id: "older",
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    await storage.create(
      { ...input, title: "Newer" },
      { id: "newer", createdAt: "2025-01-02T00:00:00.000Z" },
    );

    expect((await storage.list()).map(({ id }) => id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("counts one vote per client and feedback item", async () => {
    const storage = new InMemoryFeedbackStorage();
    const feedback = await storage.create(input);

    const first = await storage.vote(feedback.id, "client-1");
    const duplicate = await storage.vote(feedback.id, "client-1");
    const secondClient = await storage.vote(feedback.id, "client-2");

    expect(first).toMatchObject({ alreadyVoted: false, feedback: { votes: 1 } });
    expect(duplicate).toMatchObject({
      alreadyVoted: true,
      feedback: { votes: 1 },
    });
    expect(secondClient.feedback.votes).toBe(2);
  });

  it("reports missing feedback", async () => {
    const storage = new InMemoryFeedbackStorage();
    await expect(storage.vote("missing", "client-1")).rejects.toBeInstanceOf(
      FeedbackNotFoundError,
    );
  });

  it("seeds deterministic data idempotently", async () => {
    const storage = new InMemoryFeedbackStorage();
    await seedStorage(storage);
    await seedStorage(storage);
    expect(await storage.list()).toHaveLength(2);
  });

  it("creates new feedback with status new", async () => {
    const storage = new InMemoryFeedbackStorage();
    const feedback = await storage.create(input);
    expect(feedback.status).toBe("new");
  });

  it("persists a valid forward status transition", async () => {
    const storage = new InMemoryFeedbackStorage();
    const feedback = await storage.create(input);
    const updated = await storage.updateStatus(feedback.id, "planned");
    expect(updated.status).toBe("planned");
    expect((await storage.list())[0]?.status).toBe("planned");
  });

  it("rejects an invalid status transition without changing state", async () => {
    const storage = new InMemoryFeedbackStorage();
    const feedback = await storage.create(input);
    await expect(storage.updateStatus(feedback.id, "done")).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
    expect((await storage.list())[0]?.status).toBe("new");
  });

  it("rejects a status update for an unknown feedback identifier", async () => {
    const storage = new InMemoryFeedbackStorage();
    await expect(
      storage.updateStatus("missing", "planned"),
    ).rejects.toBeInstanceOf(FeedbackNotFoundError);
  });

  it("leaves vote count and dedup unaffected by a status update", async () => {
    const storage = new InMemoryFeedbackStorage();
    const feedback = await storage.create(input);
    await storage.vote(feedback.id, "client-1");
    await storage.updateStatus(feedback.id, "planned");
    const duplicate = await storage.vote(feedback.id, "client-1");
    expect(duplicate).toMatchObject({ alreadyVoted: true, feedback: { votes: 1 } });
  });
});

describe("Azure Table feedback storage", () => {
  it("records the vote marker and counter in one transaction", async () => {
    const table = {
      getEntity: vi.fn().mockResolvedValue({
        partitionKey: "feedback-1",
        rowKey: "feedback",
        title: input.title,
        description: input.description,
        category: input.category,
        displayName: input.displayName,
        votes: 2,
        createdAt: "2025-01-01T00:00:00.000Z",
        etag: "etag-1",
      }),
      submitTransaction: vi.fn().mockResolvedValue({}),
    };
    const storage = new AzureTableFeedbackStorage(
      table as unknown as TableClient,
    );

    const result = await storage.vote("feedback-1", "client-1");

    expect(result).toMatchObject({
      alreadyVoted: false,
      feedback: { votes: 3 },
    });
    expect(table.submitTransaction).toHaveBeenCalledOnce();
    const actions = table.submitTransaction.mock.calls[0]?.[0];
    expect(actions).toHaveLength(2);
    expect(actions[0][0]).toBe("create");
    expect(actions[1]).toMatchObject(["update", { votes: 3 }, "Replace"]);
  });

  it("reports an existing Azure vote without increasing the count", async () => {
    const table = {
      getEntity: vi.fn().mockResolvedValue({
        partitionKey: "feedback-1",
        rowKey: "feedback",
        title: input.title,
        description: input.description,
        category: input.category,
        displayName: input.displayName,
        votes: 2,
        createdAt: "2025-01-01T00:00:00.000Z",
        etag: "etag-1",
      }),
      submitTransaction: vi.fn().mockRejectedValue({ statusCode: 409 }),
    };
    const storage = new AzureTableFeedbackStorage(
      table as unknown as TableClient,
    );

    await expect(storage.vote("feedback-1", "client-1")).resolves.toMatchObject({
      alreadyVoted: true,
      feedback: { votes: 2 },
    });
  });

  it("persists a valid status transition via updateEntity", async () => {
    const table = {
      getEntity: vi.fn().mockResolvedValue({
        partitionKey: "feedback-1",
        rowKey: "feedback",
        title: input.title,
        description: input.description,
        category: input.category,
        displayName: input.displayName,
        votes: 2,
        status: "new",
        createdAt: "2025-01-01T00:00:00.000Z",
        etag: "etag-1",
      }),
      updateEntity: vi.fn().mockResolvedValue({}),
    };
    const storage = new AzureTableFeedbackStorage(
      table as unknown as TableClient,
    );

    const result = await storage.updateStatus("feedback-1", "planned");

    expect(result.status).toBe("planned");
    expect(table.updateEntity).toHaveBeenCalledOnce();
    const [entity, mode] = table.updateEntity.mock.calls[0] ?? [];
    expect(mode).toBe("Replace");
    expect(entity).toMatchObject({ status: "planned" });
  });

  it("rejects an invalid Azure status transition without calling updateEntity", async () => {
    const table = {
      getEntity: vi.fn().mockResolvedValue({
        partitionKey: "feedback-1",
        rowKey: "feedback",
        title: input.title,
        description: input.description,
        category: input.category,
        displayName: input.displayName,
        votes: 2,
        status: "done",
        createdAt: "2025-01-01T00:00:00.000Z",
        etag: "etag-1",
      }),
      updateEntity: vi.fn(),
    };
    const storage = new AzureTableFeedbackStorage(
      table as unknown as TableClient,
    );

    await expect(
      storage.updateStatus("feedback-1", "planned"),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(table.updateEntity).not.toHaveBeenCalled();
  });

  it("reports a missing feedback identifier without calling updateEntity", async () => {
    const table = {
      getEntity: vi.fn().mockRejectedValue({ statusCode: 404 }),
      updateEntity: vi.fn(),
    };
    const storage = new AzureTableFeedbackStorage(
      table as unknown as TableClient,
    );

    await expect(
      storage.updateStatus("missing", "planned"),
    ).rejects.toBeInstanceOf(FeedbackNotFoundError);
    expect(table.updateEntity).not.toHaveBeenCalled();
  });
});

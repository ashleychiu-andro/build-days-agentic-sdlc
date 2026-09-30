import {
  createFeedbackSchema,
  fieldLimits,
  isValidStatusTransition,
  nextFeedbackStatus,
  voteRequestSchema,
} from "../src/shared/contracts.js";

describe("feedback contracts", () => {
  it("normalizes valid feedback", () => {
    expect(
      createFeedbackSchema.parse({
        title: "  Clear examples  ",
        description: "  Add examples  ",
        category: "content",
        displayName: "  Ada  ",
      }),
    ).toEqual({
      title: "Clear examples",
      description: "Add examples",
      category: "content",
      displayName: "Ada",
    });
  });

  it("rejects missing and oversized fields", () => {
    const result = createFeedbackSchema.safeParse({
      title: "x".repeat(fieldLimits.title + 1),
      description: "",
      category: "unknown",
      displayName: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining([
          "title",
          "description",
          "category",
          "displayName",
        ]),
      );
    }
  });

  it("accepts workshop-safe client identifiers only", () => {
    expect(voteRequestSchema.safeParse({ clientId: "client_123-abc" }).success).toBe(
      true,
    );
    expect(voteRequestSchema.safeParse({ clientId: "not/valid" }).success).toBe(
      false,
    );
  });
});

describe("feedback status transitions", () => {
  it("returns the single next status in sequence", () => {
    expect(nextFeedbackStatus("new")).toBe("planned");
    expect(nextFeedbackStatus("planned")).toBe("done");
    expect(nextFeedbackStatus("done")).toBeUndefined();
  });

  it("accepts only the single forward transition", () => {
    expect(isValidStatusTransition("new", "planned")).toBe(true);
    expect(isValidStatusTransition("planned", "done")).toBe(true);
  });

  it("rejects skipping a state", () => {
    expect(isValidStatusTransition("new", "done")).toBe(false);
  });

  it("rejects reversing to an earlier state", () => {
    expect(isValidStatusTransition("done", "planned")).toBe(false);
    expect(isValidStatusTransition("planned", "new")).toBe(false);
  });

  it("rejects resubmitting the current state", () => {
    expect(isValidStatusTransition("new", "new")).toBe(false);
    expect(isValidStatusTransition("planned", "planned")).toBe(false);
  });

  it("rejects any change from the terminal done state", () => {
    expect(isValidStatusTransition("done", "done")).toBe(false);
    expect(isValidStatusTransition("done", "new")).toBe(false);
  });
});

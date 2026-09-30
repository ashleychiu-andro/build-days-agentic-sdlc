// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/client/App.js";
import type { Feedback } from "../src/shared/contracts.js";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("feedback board", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows an accessible empty state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ items: [] }));
    render(<App />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading feedback");
    expect(await screen.findByRole("heading", { name: "No feedback yet" })).toBeVisible();
  });

  it("creates feedback and votes through the complete UI flow", async () => {
    let item: Feedback | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
      const url = String(input);
      if (url === "/api/feedback" && !options?.method) {
        return jsonResponse({ items: [] });
      }
      if (url === "/api/feedback" && options?.method === "POST") {
        item = {
          id: "feedback-1",
          ...(JSON.parse(String(options.body)) as Omit<
            Feedback,
            "id" | "votes" | "createdAt" | "status"
          >),
          votes: 0,
          status: "new",
          createdAt: "2025-01-01T00:00:00.000Z",
        };
        return jsonResponse({ feedback: item }, 201);
      }
      if (url.endsWith("/votes") && item) {
        item = { ...item, votes: 1 };
        return jsonResponse({ feedback: item, alreadyVoted: false }, 201);
      }
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "No feedback yet" });

    await user.type(screen.getByLabelText("Title"), "Better examples");
    await user.type(
      screen.getByLabelText("Description"),
      "Show another API example.",
    );
    await user.selectOptions(screen.getByLabelText("Category"), "tooling");
    await user.type(screen.getByLabelText("Display name"), "Sam");
    await user.click(screen.getByRole("button", { name: "Add feedback" }));

    expect(
      await screen.findByRole("heading", { name: "Better examples" }),
    ).toBeVisible();
    const vote = screen.getByRole("button", {
      name: "Vote for Better examples. 0 votes",
    });
    await user.click(vote);
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Vote for Better examples. 1 votes",
        }),
      ).toBeVisible(),
    );
    expect(screen.getByText("Vote added for “Better examples”.")).toBeVisible();
  });

  it("shows server validation beside fields", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Check the highlighted fields and try again.",
              fieldErrors: { title: ["Enter a title."] },
            },
          },
          400,
        ),
      );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "No feedback yet" });
    await user.click(screen.getByRole("button", { name: "Add feedback" }));

    expect(await screen.findByText("Enter a title.")).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
  });

  it("offers retry after a loading error", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("The board could not load."))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText("The board could not load.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "No feedback yet" })).toBeVisible();
  });

  const baseItem: Feedback = {
    id: "feedback-1",
    title: "Better examples",
    description: "Show another API example.",
    category: "tooling",
    displayName: "Sam",
    votes: 0,
    status: "new",
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  it("renders a status badge and an advance control for a new item", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ items: [baseItem] }),
    );
    render(<App />);
    expect(await screen.findByText("New")).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Move “Better examples” from New to Planned",
      }),
    ).toBeVisible();
  });

  it("hides the advance control once an item reaches done", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ items: [{ ...baseItem, status: "done" }] }),
    );
    render(<App />);
    expect(await screen.findByText("Done")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Move “Better examples”/ }),
    ).not.toBeInTheDocument();
  });

  it("advances status on click and shows a confirmation", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/feedback") {
        return jsonResponse({ items: [baseItem] });
      }
      if (url.endsWith("/status")) {
        return jsonResponse({
          feedback: { ...baseItem, status: "planned" },
        });
      }
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    render(<App />);
    const advance = await screen.findByRole("button", {
      name: "Move “Better examples” from New to Planned",
    });
    await user.click(advance);

    expect(
      await screen.findByText("“Better examples” moved to Planned."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Move “Better examples” from Planned to Done",
      }),
    ).toBeVisible();
  });

  it("shows an error message when a status transition is rejected", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/feedback") {
        return jsonResponse({ items: [baseItem] });
      }
      if (url.endsWith("/status")) {
        return jsonResponse(
          {
            error: {
              code: "INVALID_TRANSITION",
              message: "That status change is not allowed.",
            },
          },
          409,
        );
      }
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    render(<App />);
    const advance = await screen.findByRole("button", {
      name: "Move “Better examples” from New to Planned",
    });
    await user.click(advance);

    expect(
      await screen.findByText("That status change is not allowed."),
    ).toBeVisible();
  });
});

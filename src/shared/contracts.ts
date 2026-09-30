import { z } from "zod";

export const feedbackCategories = [
  "content",
  "facilitation",
  "tooling",
  "idea",
] as const;

export const fieldLimits = {
  title: 100,
  description: 1_000,
  displayName: 60,
  clientId: 100,
} as const;

export const createFeedbackSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(fieldLimits.title),
  description: z
    .string()
    .trim()
    .min(1, "Enter a description.")
    .max(fieldLimits.description),
  category: z.enum(feedbackCategories),
  displayName: z
    .string()
    .trim()
    .min(1, "Enter your display name.")
    .max(fieldLimits.displayName),
});

export const voteRequestSchema = z.object({
  clientId: z
    .string()
    .trim()
    .min(1, "A workshop client ID is required.")
    .max(fieldLimits.clientId)
    .regex(/^[A-Za-z0-9_-]+$/, "The workshop client ID is invalid."),
});

export const feedbackStatuses = ["new", "planned", "done"] as const;

export const updateStatusSchema = z.object({
  status: z.enum(feedbackStatuses),
});

export type FeedbackCategory = (typeof feedbackCategories)[number];
export type FeedbackStatus = (typeof feedbackStatuses)[number];
export type CreateFeedbackRequest = z.infer<typeof createFeedbackSchema>;
export type VoteRequest = z.infer<typeof voteRequestSchema>;
export type UpdateStatusRequest = z.infer<typeof updateStatusSchema>;

export interface Feedback extends CreateFeedbackRequest {
  id: string;
  votes: number;
  status: FeedbackStatus;
  createdAt: string;
}

/**
 * Returns the single valid next status in the forward-only sequence
 * `new` -> `planned` -> `done`, or `undefined` when the current status is
 * terminal (`done`).
 */
export const nextFeedbackStatus = (
  current: FeedbackStatus,
): FeedbackStatus | undefined => {
  const index = feedbackStatuses.indexOf(current);
  return feedbackStatuses[index + 1];
};

/**
 * A transition is valid only when the requested status is exactly the single
 * next state after the current status. Skipping, reversing, resubmitting the
 * current status, and any change from the terminal `done` status are all
 * invalid.
 */
export const isValidStatusTransition = (
  current: FeedbackStatus,
  requested: FeedbackStatus,
): boolean => nextFeedbackStatus(current) === requested;

export interface VoteResult {
  feedback: Feedback;
  alreadyVoted: boolean;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}

import type {
  ApiError,
  CreateFeedbackRequest,
  Feedback,
  FeedbackStatus,
  VoteResult,
} from "../shared/contracts.js";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options?.headers,
    },
  });
  const body = (await response.json()) as T | ApiError;
  if (!response.ok) {
    const apiError = body as ApiError;
    throw new ApiRequestError(
      apiError.error?.message ?? "Something went wrong. Try again.",
      apiError.error?.fieldErrors,
    );
  }
  return body as T;
}

export const listFeedback = async (): Promise<Feedback[]> => {
  const result = await request<{ items: Feedback[] }>("/api/feedback");
  return result.items;
};

export const createFeedback = async (
  input: CreateFeedbackRequest,
): Promise<Feedback> => {
  const result = await request<{ feedback: Feedback }>("/api/feedback", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.feedback;
};

export const voteForFeedback = (
  id: string,
  clientId: string,
): Promise<VoteResult> =>
  request<VoteResult>(`/api/feedback/${encodeURIComponent(id)}/votes`, {
    method: "POST",
    body: JSON.stringify({ clientId }),
  });

export const updateFeedbackStatus = async (
  id: string,
  status: FeedbackStatus,
): Promise<Feedback> => {
  const result = await request<{ feedback: Feedback }>(
    `/api/feedback/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
  return result.feedback;
};

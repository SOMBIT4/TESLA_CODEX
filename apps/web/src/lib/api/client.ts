interface ApiErrorPayload {
  code?: string;
  message?: string;
}

interface ApiFailureEnvelope {
  error?: ApiErrorPayload;
}

interface ApiSuccessEnvelope<T> {
  data: T;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, headers, ...requestOptions } = options;
  const response = await fetch(toApiPath(path), {
    ...requestOptions,
    credentials: "include",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    const error = getErrorPayload(payload);
    throw new ApiError(
      error.code ?? "API_REQUEST_FAILED",
      error.message ?? "The request could not be completed.",
      response.status,
    );
  }

  if (!hasData<T>(payload)) {
    throw new ApiError(
      "INVALID_API_RESPONSE",
      "The API returned an invalid response.",
      response.status,
    );
  }

  return payload.data;
}

function toApiPath(path: string): string {
  return `/api/${path.replace(/^\/+/, "")}`;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getErrorPayload(payload: unknown): ApiErrorPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null
  ) {
    return payload.error as ApiErrorPayload;
  }

  return {};
}

function hasData<T>(payload: unknown): payload is ApiSuccessEnvelope<T> {
  return typeof payload === "object" && payload !== null && "data" in payload;
}

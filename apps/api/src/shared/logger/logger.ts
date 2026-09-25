export function logRequest(input: {
  method: string;
  path: string;
  requestId: string;
  statusCode: number;
}): void {
  console.info(
    JSON.stringify({
      level: "info",
      type: "http_request",
      ...input,
    }),
  );
}

export function logError(error: unknown, requestId: string): void {
  const message = error instanceof Error ? error.message : "Unknown error";

  console.error(
    JSON.stringify({
      level: "error",
      type: "http_error",
      requestId,
      message,
    }),
  );
}

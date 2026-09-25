import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /health", () => {
  it("returns the API health envelope", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { status: "ok", service: "api" },
    });
  });

  it("logs the completed request with its request id", async () => {
    const logSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    const response = await request(createApp()).get("/health");

    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"http_request"'),
    );
  });
});

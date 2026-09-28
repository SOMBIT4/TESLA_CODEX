import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "@/lib/api/client";

describe("apiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a relative API path with credentials and unwraps data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { name: "Nusrat" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ name: string }>("/auth/me")).resolves.toEqual({
      name: "Nusrat",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("maps a structured API failure to ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "UNAUTHENTICATED",
              message: "Authentication required.",
            },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    try {
      await apiRequest("/auth/me");
      throw new Error("Expected apiRequest to reject.");
    } catch (caughtError) {
      expect(caughtError).toBeInstanceOf(ApiError);

      const error = caughtError as ApiError;
      expect(error.code).toBe("UNAUTHENTICATED");
      expect(error.message).toBe("Authentication required.");
      expect(error.status).toBe(401);
    }
  });
});

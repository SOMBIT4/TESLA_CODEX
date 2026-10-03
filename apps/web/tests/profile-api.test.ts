import { afterEach, describe, expect, it, vi } from "vitest";
import { updateCurrentUser } from "@/lib/api/auth";
import { updateDriverVehicle } from "@/lib/api/driver";

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("profile API wrappers", () => {
  it("patches only the current user's fields and accepts a cleared phone", async () => {
    const user = {
      id: "nusrat-1",
      name: "Nusrat Ahmed",
      email: "nusrat@example.com",
      role: "PASSENGER",
      phoneNumber: null,
      createdAt: "2026-10-03T00:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ user }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateCurrentUser({ name: "Nusrat Ahmed", phoneNumber: null }),
    ).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ name: "Nusrat Ahmed", phoneNumber: null }),
      }),
    );
  });

  it("patches the current driver's vehicle and unwraps the snapshot", async () => {
    const snapshot = {
      isOnline: false,
      vehicle: {
        id: "vehicle-1",
        name: "Bullet Executive",
        capacity: 4,
        isActive: true,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(snapshot));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateDriverVehicle({ name: "Bullet Executive", capacity: 4 }),
    ).resolves.toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/driver/me/vehicle",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ name: "Bullet Executive", capacity: 4 }),
      }),
    );
  });
});

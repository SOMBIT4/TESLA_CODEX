import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

import SessionGuard from "@/components/auth/session-guard";
import DriverPage from "@/app/driver/page";

const passenger = {
  id: "nusrat-id",
  name: "Nusrat",
  email: "nusrat@example.com",
  role: "PASSENGER" as const,
  createdAt: "2026-09-28T00:00:00.000Z",
};

const driver = {
  ...passenger,
  id: "jashim-id",
  name: "Jashim",
  role: "DRIVER" as const,
};

describe("role workspace access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects a driver away from the passenger workspace", async () => {
    mocks.getCurrentUser.mockResolvedValue(driver);
    render(
      <SessionGuard requiredRole="PASSENGER">
        <p>Passenger dashboard</p>
      </SessionGuard>,
    );

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/driver");
    });
    expect(screen.queryByText("Passenger dashboard")).not.toBeInTheDocument();
  });

  it("shows the honest placeholder to a driver", async () => {
    mocks.getCurrentUser.mockResolvedValue(driver);
    render(<DriverPage />);

    expect(
      await screen.findByText("Driver workspace is coming next"),
    ).toBeInTheDocument();
  });

  it("redirects a passenger away from the driver placeholder", async () => {
    mocks.getCurrentUser.mockResolvedValue(passenger);
    render(<DriverPage />);

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/passenger");
    });
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const replace = vi.fn();
  return {
    getCurrentUser: vi.fn(),
    replace,
    router: { replace },
  };
});

vi.mock("@/lib/api/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/components/profile/profile-details-card", () => ({
  ProfileDetailsCard: () => <p>Personal profile card</p>,
}));

vi.mock("@/components/profile/driver-vehicle-profile-card", () => ({
  DriverVehicleProfileCard: () => <p>Driver vehicle profile card</p>,
}));

vi.mock("@/components/layout/app-header", () => ({
  default: () => <header>Authenticated header</header>,
}));

import SessionGuard from "@/components/auth/session-guard";
import DriverPage from "@/app/driver/page";
import DriverProfilePage from "@/app/driver/profile/page";
import PassengerLayout from "@/app/passenger/layout";

vi.mock("@/components/driver/driver-dashboard", () => ({
  default: () => <p>Driver dashboard</p>,
}));

const passenger = {
  id: "nusrat-id",
  name: "Nusrat",
  email: "nusrat@example.com",
  role: "PASSENGER" as const,
  phoneNumber: null,
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

  it("shows the driver dashboard to a driver", async () => {
    mocks.getCurrentUser.mockResolvedValue(driver);
    render(<DriverPage />);

    expect(await screen.findByText("Driver dashboard")).toBeInTheDocument();
  });

  it("redirects a passenger away from the driver dashboard", async () => {
    mocks.getCurrentUser.mockResolvedValue(passenger);
    render(<DriverPage />);

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/passenger");
    });
  });

  it("renders the driver profile for a driver session", async () => {
    mocks.getCurrentUser.mockResolvedValue(driver);
    render(<DriverProfilePage />);

    expect(await screen.findByText("Personal profile card")).toBeVisible();
    expect(screen.getByText("Driver vehicle profile card")).toBeVisible();
  });

  it("redirects a passenger away from the driver profile", async () => {
    mocks.getCurrentUser.mockResolvedValue(passenger);
    render(<DriverProfilePage />);

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/passenger");
    });
    expect(screen.queryByText("Driver vehicle profile card")).toBeNull();
  });

  it("redirects a driver away from the passenger profile workspace", async () => {
    mocks.getCurrentUser.mockResolvedValue(driver);
    render(
      <PassengerLayout>
        <p>Passenger profile content</p>
      </PassengerLayout>,
    );

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/driver");
    });
    expect(screen.queryByText("Passenger profile content")).toBeNull();
  });
});

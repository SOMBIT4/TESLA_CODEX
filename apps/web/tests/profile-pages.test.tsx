import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileDetailsCard } from "@/components/profile/profile-details-card";
import { DriverVehicleProfileCard } from "@/components/profile/driver-vehicle-profile-card";
import { ApiError } from "@/lib/api/client";
import { getCurrentUser, updateCurrentUser } from "@/lib/api/auth";
import {
  getActivePool,
  getDriverSnapshot,
  updateDriverVehicle,
} from "@/lib/api/driver";
import type {
  DriverActivePool,
  DriverSnapshot,
  PublicUser,
} from "@/lib/api/types";

const routerMock = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("@/lib/api/auth", () => ({
  getCurrentUser: vi.fn(),
  updateCurrentUser: vi.fn(),
}));

vi.mock("@/lib/api/driver", () => ({
  getActivePool: vi.fn(),
  getDriverSnapshot: vi.fn(),
  updateDriverVehicle: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedUpdateCurrentUser = vi.mocked(updateCurrentUser);
const mockedGetDriverSnapshot = vi.mocked(getDriverSnapshot);
const mockedGetActivePool = vi.mocked(getActivePool);
const mockedUpdateDriverVehicle = vi.mocked(updateDriverVehicle);

const user: PublicUser = {
  id: "nusrat-1",
  name: "Nusrat",
  email: "nusrat@example.com",
  role: "PASSENGER",
  phoneNumber: "+8801712345678",
  createdAt: "2026-10-03T00:00:00.000Z",
};

const snapshot: DriverSnapshot = {
  isOnline: false,
  vehicle: {
    id: "vehicle-1",
    name: "Bullet",
    capacity: 3,
    isActive: true,
  },
};

const activePool: DriverActivePool = {
  id: "pool-1",
  status: "MATCHED",
  pickupZone: "Banani",
  vehicle: { name: "Bullet", capacity: 3 },
  occupiedSeats: 1,
  members: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCurrentUser.mockResolvedValue(user);
  mockedUpdateCurrentUser.mockResolvedValue(user);
  mockedGetDriverSnapshot.mockResolvedValue(snapshot);
  mockedGetActivePool.mockResolvedValue(null);
  mockedUpdateDriverVehicle.mockResolvedValue(snapshot);
});

describe("profile screens", () => {
  it("loads personal details and keeps email read-only", async () => {
    render(<ProfileDetailsCard />);

    expect(screen.getByRole("status")).toHaveAccessibleName("Loading profile…");
    const name = await screen.findByLabelText("Full name");
    const email = screen.getByLabelText("Email address");
    const phone = screen.getByLabelText("Phone number (optional)");

    expect(name).toHaveValue("Nusrat");
    expect(email).toHaveValue("nusrat@example.com");
    expect(email).toHaveAttribute("readonly");
    expect(phone).toHaveValue("+8801712345678");
    expect(screen.queryByLabelText("Vehicle name")).not.toBeInTheDocument();
  });

  it("saves the name and phone through the self-profile endpoint", async () => {
    const updatedUser = {
      ...user,
      name: "Nusrat Ahmed",
      phoneNumber: "+8801812345678",
    };
    mockedUpdateCurrentUser.mockResolvedValue(updatedUser);
    const userAction = userEvent.setup();
    render(<ProfileDetailsCard />);

    const name = await screen.findByLabelText("Full name");
    const phone = screen.getByLabelText("Phone number (optional)");
    await userAction.clear(name);
    await userAction.type(name, "Nusrat Ahmed");
    await userAction.clear(phone);
    await userAction.type(phone, "01812345678");
    await userAction.click(
      screen.getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(mockedUpdateCurrentUser).toHaveBeenCalledWith({
        name: "Nusrat Ahmed",
        phoneNumber: "01812345678",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Profile updated",
    );
  });

  it("maps a cleared phone field to null", async () => {
    const userAction = userEvent.setup();
    render(<ProfileDetailsCard />);

    const phone = await screen.findByLabelText("Phone number (optional)");
    await userAction.clear(phone);
    await userAction.click(
      screen.getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(mockedUpdateCurrentUser).toHaveBeenCalledWith({
        name: "Nusrat",
        phoneNumber: null,
      }),
    );
  });

  it("shows profile validation and API errors without losing the form", async () => {
    mockedUpdateCurrentUser.mockRejectedValue(
      new ApiError("VALIDATION_ERROR", "Invalid request data.", 400),
    );
    const userAction = userEvent.setup();
    render(<ProfileDetailsCard />);

    await userAction.click(
      await screen.findByRole("button", { name: "Save changes" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your name and phone number, then try again.",
    );
    expect(screen.getByLabelText("Full name")).toHaveValue("Nusrat");
  });

  it("enables vehicle editing only when offline and without an active pool", async () => {
    render(<DriverVehicleProfileCard />);

    expect(await screen.findByLabelText("Vehicle name")).toHaveValue("Bullet");
    expect(screen.getByLabelText("Vehicle name")).toBeDisabled();
    const edit = screen.getByRole("button", { name: "Edit vehicle" });
    expect(edit).toBeEnabled();

    await userEvent.setup().click(edit);
    expect(screen.getByLabelText("Vehicle name")).toBeEnabled();
    expect(screen.getByLabelText("Vehicle capacity")).toBeEnabled();
  });

  it.each([
    ["online", { ...snapshot, isOnline: true }, null],
    ["in an active pool", snapshot, activePool],
  ] as const)(
    "keeps vehicle editing disabled while the driver is %s",
    async (_state, driverSnapshot, pool) => {
      mockedGetDriverSnapshot.mockResolvedValue(driverSnapshot);
      mockedGetActivePool.mockResolvedValue(pool);
      render(<DriverVehicleProfileCard />);

      expect(
        await screen.findByRole("button", { name: "Edit vehicle" }),
      ).toBeDisabled();
      expect(screen.getByLabelText("Vehicle name")).toBeDisabled();
      expect(screen.getByLabelText("Vehicle capacity")).toBeDisabled();
    },
  );

  it("explains a vehicle lock conflict and refreshes both driver reads", async () => {
    mockedGetDriverSnapshot
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({ ...snapshot, isOnline: true });
    mockedGetActivePool
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(activePool);
    mockedUpdateDriverVehicle.mockRejectedValue(
      new ApiError(
        "VEHICLE_PROFILE_LOCKED",
        "Vehicle details cannot be changed while online or in an active pool.",
        409,
      ),
    );
    const userAction = userEvent.setup();
    render(<DriverVehicleProfileCard />);

    await userAction.click(
      await screen.findByRole("button", { name: "Edit vehicle" }),
    );
    const vehicleName = screen.getByLabelText("Vehicle name");
    await userAction.clear(vehicleName);
    await userAction.type(vehicleName, "Changed");
    await userAction.click(
      screen.getByRole("button", { name: "Save vehicle" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Vehicle details are locked while you are online or in an active pool.",
    );
    await waitFor(() => {
      expect(mockedGetDriverSnapshot).toHaveBeenCalledTimes(2);
      expect(mockedGetActivePool).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole("button", { name: "Edit vehicle" })).toBeDisabled();
  });
});

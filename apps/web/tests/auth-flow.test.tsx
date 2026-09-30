import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  registerDriver: vi.fn(),
  registerPassenger: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  login: mocks.login,
  registerDriver: mocks.registerDriver,
  registerPassenger: mocks.registerPassenger,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

import LoginForm from "@/components/auth/login-form";
import RegisterForm from "@/components/auth/register-form";
import LoginPage from "@/app/(public)/login/page";

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

describe("passenger authentication forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a passenger to their dashboard after login", async () => {
    mocks.login.mockResolvedValue(passenger);
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), passenger.email);
    await user.type(screen.getByLabelText("Password"), "demo1234");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mocks.replace).toHaveBeenCalledWith("/passenger");
  });

  it("sends a driver to the driver workspace after login", async () => {
    mocks.login.mockResolvedValue(driver);
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), driver.email);
    await user.type(screen.getByLabelText("Password"), "demo1234");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mocks.replace).toHaveBeenCalledWith("/driver");
  });

  it("sends a newly registered passenger to their dashboard", async () => {
    mocks.registerPassenger.mockResolvedValue(passenger);
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Name"), passenger.name);
    await user.type(screen.getByLabelText("Email"), passenger.email);
    await user.type(screen.getByLabelText("Password"), "demo1234");
    await user.click(
      screen.getByRole("button", { name: "Create passenger account" }),
    );

    expect(mocks.replace).toHaveBeenCalledWith("/passenger");
  });

  it("switches the signup page to driver mode and creates a vehicle profile", async () => {
    mocks.registerDriver.mockResolvedValue(driver);
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.click(screen.getByRole("tab", { name: "Driver account" }));
    await user.type(screen.getByLabelText("Name"), driver.name);
    await user.type(screen.getByLabelText("Email"), driver.email);
    await user.type(screen.getByLabelText("Password"), "demo1234");
    await user.clear(screen.getByLabelText("Vehicle name"));
    await user.type(screen.getByLabelText("Vehicle name"), "Bullet");
    await user.click(
      screen.getByRole("button", { name: "Create driver account" }),
    );

    expect(mocks.registerDriver).toHaveBeenCalledWith({
      name: driver.name,
      email: driver.email,
      password: "demo1234",
      vehicleName: "Bullet",
      vehicleCapacity: 3,
    });
    expect(mocks.replace).toHaveBeenCalledWith("/driver");
  });

  it("offers a driver between one and four vehicle seats", async () => {
    mocks.registerDriver.mockResolvedValue(driver);
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.click(screen.getByRole("tab", { name: "Driver account" }));

    const seatChoices = within(
      screen.getByRole("radiogroup", { name: "Seats" }),
    ).getAllByRole("radio");
    expect(seatChoices.map((choice) => choice.getAttribute("value"))).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);

    await user.type(screen.getByLabelText("Name"), driver.name);
    await user.type(screen.getByLabelText("Email"), driver.email);
    await user.type(screen.getByLabelText("Password"), "demo1234");
    await user.click(screen.getByRole("radio", { name: "4" }));
    await user.click(
      screen.getByRole("button", { name: "Create driver account" }),
    );

    expect(mocks.registerDriver).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleCapacity: 4 }),
    );
  });

  it("lets a passenger reveal the password while keeping the field labeled", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeVisible();
  });

  it("disables the sign-in control while authentication is pending", async () => {
    let resolveLogin: ((value: typeof passenger) => void) | undefined;
    mocks.login.mockReturnValue(
      new Promise<typeof passenger>((resolve) => {
        resolveLogin = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), passenger.email);
    await user.type(screen.getByLabelText("Password"), "demo1234");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();

    resolveLogin?.(passenger);
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/passenger"),
    );
  });

  it("uses the shared branded auth shell with a static route illustration", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("img", {
        name: "Dhaka route from Banani to Mohakhali",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByText("Your next ride starts here.")).toBeVisible();
  });
});

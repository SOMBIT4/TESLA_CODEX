import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  registerPassenger: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  login: mocks.login,
  registerPassenger: mocks.registerPassenger,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

import LoginForm from "@/components/auth/login-form";
import RegisterForm from "@/components/auth/register-form";

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
});

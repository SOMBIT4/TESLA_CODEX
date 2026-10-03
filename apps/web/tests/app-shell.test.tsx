import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppHeader from "@/components/layout/app-header";
import LandingPage from "@/components/marketing/landing-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/lib/api/auth", () => ({
  logout: vi.fn(),
}));

describe("application shell", () => {
  it("presents an original Dhaka ride-sharing brand with an accessible header", () => {
    const { container } = render(<AppHeader />);

    expect(screen.getByRole("banner")).toHaveAccessibleName(
      "Dhaka Tesla Pool navigation",
    );
    expect(screen.getByText("Dhaka Tesla Pool")).toBeVisible();
    expect(screen.getByText("Shared rides for Dhaka")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(container.querySelector('img[alt*="Tesla"]')).toBeNull();
    expect(container).not.toHaveTextContent("tesla.com");
  });

  it.each([
    ["PASSENGER", "/passenger/profile"],
    ["DRIVER", "/driver/profile"],
  ] as const)("links the %s workspace to its profile", (role, href) => {
    render(<AppHeader role={role} />);

    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      href,
    );
  });

  it("gives a new passenger a clear route into the product", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", {
        name: "Share a smarter ride across Dhaka.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Start riding" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByText("Banani")).toBeVisible();
    expect(screen.getByText("Mohakhali")).toBeVisible();
  });
});

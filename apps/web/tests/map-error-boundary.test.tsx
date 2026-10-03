import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MapErrorBoundary from "@/components/maps/map-error-boundary";

function BrokenMapLayer(): never {
  throw new Error("Map component render failed");
}

describe("MapErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("contains a map render crash and keeps the surrounding UI mounted", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <>
        <MapErrorBoundary fallback={<p role="status">Map unavailable</p>}>
          <BrokenMapLayer />
        </MapErrorBoundary>
        <button type="button">Continue</button>
      </>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Map unavailable");
    expect(screen.getByRole("button", { name: "Continue" })).toBeVisible();
    consoleError.mockRestore();
  });
});

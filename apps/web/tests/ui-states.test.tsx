import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

describe("local UI state primitives", () => {
  it("keeps an absent status textual", () => {
    render(<Badge variant="muted">No active ride</Badge>);

    expect(screen.getByText("No active ride")).toBeVisible();
  });

  it("gives an alert its semantic role", () => {
    render(<Alert>Unable to load your rides.</Alert>);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load your rides.",
    );
  });

  it("provides accessible loading text for skeletons", () => {
    render(<Skeleton label="Loading ride history" />);

    expect(screen.getByRole("status")).toHaveAccessibleName(
      "Loading ride history",
    );
  });
});

import { describe, expect, it } from "vitest";
import { isTerminalRideStatus } from "@/lib/api/types";
import { formatPoysha, formatTaka } from "@/lib/format/money";

describe("passenger ride display utilities", () => {
  it("formats integer poysha as taka", () => {
    expect(formatPoysha(8600)).toBe("৳86");
    expect(formatPoysha(8655)).toBe("৳86.55");
  });

  it("formats pool fares with exactly two decimal Taka places", () => {
    expect(formatTaka(7100)).toBe("71.00 Tk");
    expect(formatTaka(8655)).toBe("86.55 Tk");
  });

  it("identifies only completed and cancelled rides as terminal", () => {
    expect(isTerminalRideStatus("COMPLETED")).toBe(true);
    expect(isTerminalRideStatus("CANCELLED")).toBe(true);
    expect(isTerminalRideStatus("REQUESTED")).toBe(false);
    expect(isTerminalRideStatus("STARTED")).toBe(false);
  });
});

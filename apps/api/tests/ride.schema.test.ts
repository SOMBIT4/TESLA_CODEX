import { describe, expect, it } from "vitest";
import { createRideSchema } from "../src/modules/rides/ride.schema.js";

const validRide = {
  pickupZone: "Banani",
  destinationZone: "Mohakhali",
  seats: 1,
};

describe("ride request schema", () => {
  it("accepts a supported route with one to three seats", () => {
    expect(createRideSchema.safeParse(validRide).success).toBe(true);
    expect(createRideSchema.safeParse({ ...validRide, seats: 3 }).success).toBe(
      true,
    );
  });

  it.each([0, 4, 1.5])("rejects an invalid seat count of %s", (seats) => {
    expect(createRideSchema.safeParse({ ...validRide, seats }).success).toBe(
      false,
    );
  });

  it("rejects a request with the same pickup and destination", () => {
    expect(
      createRideSchema.safeParse({
        ...validRide,
        destinationZone: validRide.pickupZone,
      }).success,
    ).toBe(false);
  });

  it("rejects unsupported areas", () => {
    expect(
      createRideSchema.safeParse({ ...validRide, pickupZone: "Airport" })
        .success,
    ).toBe(false);
  });
});

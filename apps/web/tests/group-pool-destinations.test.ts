import { describe, expect, it } from "vitest";
import { groupPoolDestinations } from "@/lib/maps/group-pool-destinations";
import type { DriverActivePoolMember } from "@/lib/api/types";

const members: DriverActivePoolMember[] = [
  {
    rideId: "ride-nusrat",
    passengerName: "Nusrat",
    pickupZone: "Banani",
    destinationZone: "Mohakhali",
    seatsReserved: 1,
    farePoysha: 7100,
  },
  {
    rideId: "ride-rafiq",
    passengerName: "Rafiq",
    pickupZone: "Banani",
    destinationZone: "Mohakhali",
    seatsReserved: 2,
    farePoysha: 5900,
  },
  {
    rideId: "ride-jamal",
    passengerName: "Jamal",
    pickupZone: "Banani",
    destinationZone: "Gulshan 1",
    seatsReserved: 1,
    farePoysha: 7400,
  },
];

describe("groupPoolDestinations", () => {
  it("groups members sharing a destination with only display-safe fields", () => {
    expect(groupPoolDestinations(members)).toEqual([
      {
        zone: "Gulshan 1",
        members: [{ passengerName: "Jamal", seatsReserved: 1 }],
      },
      {
        zone: "Mohakhali",
        members: [
          { passengerName: "Nusrat", seatsReserved: 1 },
          { passengerName: "Rafiq", seatsReserved: 2 },
        ],
      },
    ]);
  });

  it("returns no groups for an empty active-member list", () => {
    expect(groupPoolDestinations([])).toEqual([]);
  });
});

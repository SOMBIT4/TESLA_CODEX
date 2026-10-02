import { DHAKA_AREAS as backendAreas } from "../../api/src/modules/fares/fare-rules";
import { DHAKA_AREAS as frontendAreas } from "@/lib/api/types";
import { DHAKA_QA_BOUNDS, ZONE_COORDINATES } from "@/lib/maps/zone-coordinates";
import { describe, expect, it } from "vitest";

describe("Dhaka zone coordinates", () => {
  it("covers the canonical backend zones in the same order as the web contract", () => {
    expect(backendAreas).toHaveLength(9);
    expect(frontendAreas).toEqual(backendAreas);
    expect(Object.keys(ZONE_COORDINATES)).toEqual([...backendAreas]);
  });

  it("keeps every zone center inside the approved Dhaka bounds", () => {
    expect(DHAKA_QA_BOUNDS).toEqual({
      minLatitude: 23.65,
      maxLatitude: 23.95,
      minLongitude: 90.25,
      maxLongitude: 90.55,
    });

    for (const zone of backendAreas) {
      const coordinate = ZONE_COORDINATES[zone];

      expect(coordinate.latitude, `${zone} latitude`).toBeGreaterThanOrEqual(
        23.65,
      );
      expect(coordinate.latitude, `${zone} latitude`).toBeLessThanOrEqual(
        23.95,
      );
      expect(coordinate.longitude, `${zone} longitude`).toBeGreaterThanOrEqual(
        90.25,
      );
      expect(coordinate.longitude, `${zone} longitude`).toBeLessThanOrEqual(
        90.55,
      );
    }
  });
});

import type { DhakaArea } from "@/lib/api/types";

export interface ZoneCoordinate {
  latitude: number;
  longitude: number;
}

export const DHAKA_QA_BOUNDS = {
  minLatitude: 23.65,
  maxLatitude: 23.95,
  minLongitude: 90.25,
  maxLongitude: 90.55,
} as const;

export const ZONE_COORDINATES: Readonly<Record<DhakaArea, ZoneCoordinate>> = {
  Banani: { latitude: 23.7937, longitude: 90.4066 },
  "Gulshan 1": { latitude: 23.7808, longitude: 90.4169 },
  "Gulshan 2": { latitude: 23.7937, longitude: 90.4156 },
  Mohakhali: { latitude: 23.7776, longitude: 90.399 },
  Dhanmondi: { latitude: 23.7461, longitude: 90.3742 },
  Mirpur: { latitude: 23.8223, longitude: 90.3654 },
  Uttara: { latitude: 23.8759, longitude: 90.3795 },
  Farmgate: { latitude: 23.7572, longitude: 90.3892 },
  Bashundhara: { latitude: 23.8151, longitude: 90.4255 },
};

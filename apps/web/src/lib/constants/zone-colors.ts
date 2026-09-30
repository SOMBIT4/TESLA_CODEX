import type { DhakaArea } from "@/lib/api/types";

/**
 * Each pickup zone owns a line colour, the way a metro map colours its lines.
 * The same colour follows a zone everywhere it appears, so riders and drivers
 * can recognise a route at a glance. Status is never communicated by these
 * colours alone.
 */
export const ZONE_COLORS: Record<DhakaArea, string> = {
  Banani: "#E8562F",
  "Gulshan 1": "#E9A20C",
  "Gulshan 2": "#0E9A6C",
  Mohakhali: "#2479D1",
  Dhanmondi: "#C6377A",
  Mirpur: "#7A4FD6",
  Uttara: "#0C9CAB",
  Farmgate: "#A2582A",
  Bashundhara: "#5B8A1E",
};

const FALLBACK_ZONE_COLOR = "#6B756F";

export function zoneColor(zone: string): string {
  return ZONE_COLORS[zone as DhakaArea] ?? FALLBACK_ZONE_COLOR;
}

import { z } from "zod";
import {
  DHAKA_AREAS,
  MAX_RIDE_SEATS,
  MIN_RIDE_SEATS,
} from "../fares/fare-rules.js";

export const createRideSchema = z
  .object({
    pickupZone: z.enum(DHAKA_AREAS),
    destinationZone: z.enum(DHAKA_AREAS),
    seats: z.number().int().min(MIN_RIDE_SEATS).max(MAX_RIDE_SEATS),
  })
  .strip()
  .refine((input) => input.pickupZone !== input.destinationZone, {
    message: "Pickup and destination must be different areas.",
    path: ["destinationZone"],
  });

export type CreateRideInput = z.infer<typeof createRideSchema>;

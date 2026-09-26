import { z } from "zod";
import { DHAKA_AREAS } from "../fares/fare-rules.js";

export const createRideSchema = z
  .object({
    pickupZone: z.enum(DHAKA_AREAS),
    destinationZone: z.enum(DHAKA_AREAS),
    seats: z.number().int().min(1).max(3),
  })
  .strip()
  .refine((input) => input.pickupZone !== input.destinationZone, {
    message: "Pickup and destination must be different areas.",
    path: ["destinationZone"],
  });

export type CreateRideInput = z.infer<typeof createRideSchema>;

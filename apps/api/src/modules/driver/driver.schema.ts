import { z } from "zod";

export const driverStatusSchema = z
  .object({
    isOnline: z.boolean(),
  })
  .strip();

export type DriverStatusInput = z.infer<typeof driverStatusSchema>;

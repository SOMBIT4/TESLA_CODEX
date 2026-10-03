import { z } from "zod";

export const driverStatusSchema = z
  .object({
    isOnline: z.boolean(),
  })
  .strip();

export type DriverStatusInput = z.infer<typeof driverStatusSchema>;

export const driverVehicleUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    capacity: z.number().int().min(1).max(4),
  })
  .strict();

export type DriverVehicleUpdateInput = z.infer<
  typeof driverVehicleUpdateSchema
>;

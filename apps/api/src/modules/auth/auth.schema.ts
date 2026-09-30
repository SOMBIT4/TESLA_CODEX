import { z } from "zod";
import { USER_ROLES } from "./auth.types.js";

const nameSchema = z.string().trim().min(2).max(100);
const emailSchema = z.string().trim().toLowerCase().email().max(255);
const passwordSchema = z.string().min(8).max(72);

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(USER_ROLES).default("PASSENGER"),
    vehicleName: z.string().trim().min(2).max(100).optional(),
    vehicleCapacity: z.number().int().min(1).max(8).optional(),
  })
  .superRefine((input, context) => {
    if (input.role !== "DRIVER") {
      return;
    }

    if (!input.vehicleName) {
      context.addIssue({
        code: "custom",
        path: ["vehicleName"],
        message: "Vehicle name is required for driver registration.",
      });
    }

    if (input.vehicleCapacity === undefined) {
      context.addIssue({
        code: "custom",
        path: ["vehicleCapacity"],
        message: "Vehicle capacity is required for driver registration.",
      });
    }
  })
  .strip();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strip();

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

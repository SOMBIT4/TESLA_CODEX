import { z } from "zod";
import { USER_ROLES } from "./auth.types.js";

const nameSchema = z.string().trim().min(2).max(100);
const emailSchema = z.string().trim().toLowerCase().email().max(255);
const passwordSchema = z.string().min(8).max(72);

const normalizedPhoneSchema = z
  .string()
  .transform((phoneNumber) => phoneNumber.trim().replace(/[\s-]/g, ""))
  .refine(
    (phoneNumber) =>
      /^01[3-9][0-9]{8}$/.test(phoneNumber) ||
      /^\+8801[3-9][0-9]{8}$/.test(phoneNumber),
    { error: "Enter a valid Bangladesh mobile number." },
  )
  .transform((phoneNumber) =>
    phoneNumber.startsWith("+880")
      ? phoneNumber
      : `+880${phoneNumber.slice(1)}`,
  );

// Pool vehicles are small cars; a driver can offer at most four seats.
export const MAX_VEHICLE_CAPACITY = 4;

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(USER_ROLES).default("PASSENGER"),
    vehicleName: z.string().trim().min(2).max(100).optional(),
    vehicleCapacity: z
      .number()
      .int()
      .min(1)
      .max(MAX_VEHICLE_CAPACITY)
      .optional(),
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

export const profileUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    phoneNumber: z.union([normalizedPhoneSchema, z.null()]).optional(),
  })
  .strict()
  .refine(
    (input) => input.name !== undefined || input.phoneNumber !== undefined,
    { error: "At least one profile field must be provided." },
  );

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

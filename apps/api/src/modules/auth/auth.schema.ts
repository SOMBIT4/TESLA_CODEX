import { z } from "zod";

const nameSchema = z.string().trim().min(2).max(100);
const emailSchema = z.string().trim().toLowerCase().email().max(255);
const passwordSchema = z.string().min(8).max(72);

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strip();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strip();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

import { apiRequest } from "./client";
import type { PublicUser } from "./types";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export async function registerPassenger(
  input: RegisterInput,
): Promise<PublicUser> {
  const result = await apiRequest<{ user: PublicUser }>("/auth/register", {
    method: "POST",
    body: input,
  });

  return result.user;
}

export async function login(input: LoginInput): Promise<PublicUser> {
  const result = await apiRequest<{ user: PublicUser }>("/auth/login", {
    method: "POST",
    body: input,
  });

  return result.user;
}

export async function getCurrentUser(): Promise<PublicUser> {
  const result = await apiRequest<{ user: PublicUser }>("/auth/me");

  return result.user;
}

export async function logout(): Promise<void> {
  await apiRequest<{ loggedOut: true }>("/auth/logout", { method: "POST" });
}

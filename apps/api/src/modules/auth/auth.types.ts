export const USER_ROLES = ["PASSENGER", "DRIVER"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface AuthUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date | string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date | string;
}

export interface AuthIdentity {
  userId: string;
  role: UserRole;
}

export interface AuthSession {
  user: PublicUser;
  token: string;
}

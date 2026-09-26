# Passenger Authentication Design

## Goal

Add the first authentication boundary for Dhaka Tesla Pool so passengers can
register, sign in, sign out, and retrieve their own authenticated identity.
Provide reusable role authorization middleware for the driver and ride feature
branches that follow.

## Scope

### Included

- Passenger registration with email, name, and password.
- Email/password login.
- JWT issuance with an HttpOnly cookie.
- Logout by clearing the auth cookie.
- Authenticated `GET /api/auth/me`.
- `requireAuth` and `requireRole` Express middleware.
- Bcrypt password hashing and comparison.
- Parameterized user repository queries.
- Stable validation, authentication, duplicate-email, and authorization errors.
- Tests for the security-sensitive paths without requiring a live database.

### Excluded

- Public driver registration.
- Refresh tokens, password reset, email verification, MFA, OAuth, rate
  limiting, CSRF tokens, and an email provider.
- Passenger or driver UI pages; the web auth forms belong to a later UI task.
- Ride authorization and ownership queries; later ride services consume the
  authenticated request identity.

## API Contract

All responses use the existing `{ data: ... }` success envelope and central
`{ error: { code, message } }` failure envelope.

### `POST /api/auth/register`

Request:

```json
{
  "name": "Nusrat",
  "email": "nusrat@example.com",
  "password": "demo-pass-123"
}
```

The public endpoint always creates `PASSENGER` users. It never accepts a role
from the request body.

Success: `201 Created`

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "name": "Nusrat",
      "email": "nusrat@example.com",
      "role": "PASSENGER",
      "createdAt": "timestamp"
    }
  }
}
```

The response sets the `auth_token` cookie so registration creates an
authenticated session immediately.

Failures:

- `400 VALIDATION_ERROR` for malformed input.
- `409 EMAIL_ALREADY_REGISTERED` when the normalized email is already used.

### `POST /api/auth/login`

Request:

```json
{
  "email": "nusrat@example.com",
  "password": "demo-pass-123"
}
```

Success: `200 OK`, returning the same public user shape and setting the
`auth_token` cookie.

Failure: `401 INVALID_CREDENTIALS` for an unknown email or incorrect password;
the API does not reveal which credential was wrong.

### `POST /api/auth/logout`

Success: `200 OK` with:

```json
{ "data": { "loggedOut": true } }
```

The endpoint clears `auth_token` and does not require a valid cookie, so it is
safe to call repeatedly.

### `GET /api/auth/me`

Requires `auth_token`. Success: `200 OK` with the public user shape. The
middleware verifies the JWT and the service loads the current user by ID, so a
deleted user cannot keep using a previously issued token.

Failure: `401 UNAUTHENTICATED` when the cookie is missing, malformed, expired,
or points to a user that no longer exists.

## Validation and Normalization

- `name`: trimmed, 2–100 characters.
- `email`: trimmed, lowercased, valid email format, maximum 255 characters.
- `password`: 8–72 characters to stay within bcrypt's safe input boundary.
- Registration ignores unknown role fields rather than allowing privilege
  escalation.

## Cookie and JWT Rules

- Cookie name: `auth_token`.
- `httpOnly: true`.
- `sameSite: "lax"`.
- `secure: true` only when `NODE_ENV === "production"`.
- `path: "/"`.
- JWT payload contains only `sub` and `role`; password hashes never enter the
  token or response.
- JWT signing uses `env.JWT_SECRET` and `env.JWT_EXPIRES_IN`.
- Logout clears the cookie with the same path and security attributes.

## Backend Boundaries

```text
route → validation → controller → service → repository → PostgreSQL
```

- `auth.schema.ts` owns Zod request validation and normalization.
- `auth.repository.ts` owns parameterized `users` queries only.
- `auth.service.ts` owns registration, login, JWT, cookie data, and public-user
  mapping.
- `auth.controller.ts` translates HTTP input and output only.
- `auth.middleware.ts` verifies the cookie JWT and attaches a typed
  `request.user` identity.
- `role.middleware.ts` rejects authenticated users whose role is not allowed.
- `auth.routes.ts` maps the four endpoints and their middleware.

## Error Codes

- `VALIDATION_ERROR` — request body fails the schema.
- `EMAIL_ALREADY_REGISTERED` — normalized email conflicts with an existing user.
- `INVALID_CREDENTIALS` — login credentials are not valid.
- `UNAUTHENTICATED` — a protected endpoint has no valid identity.
- `FORBIDDEN` — an authenticated identity lacks the required role.

## Testing Strategy

Risk-first tests must cover:

- passwords are stored only as bcrypt hashes;
- public registration cannot create a driver account;
- duplicate normalized emails return `409`;
- login sets an HttpOnly cookie and rejects invalid credentials uniformly;
- logout clears the cookie and is idempotent;
- missing, malformed, and expired JWTs return `401`;
- `/api/auth/me` returns only the authenticated user's public fields;
- `requireRole("DRIVER")` returns `403` for passengers and allows drivers;
- SQL repository calls remain parameterized and never select password hashes into
  public responses.

## Success Criteria

- The four auth endpoints are mounted under `/api/auth`.
- Auth tests pass without requiring PostgreSQL.
- Existing database, health, build, and formatting checks remain green.
- The README documents the auth endpoints and demo account expectation without
  committing real secrets.

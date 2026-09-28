"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const user = await login({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      router.replace(user.role === "PASSENGER" ? "/passenger" : "/driver");
    } catch (caughtError) {
      setError(toErrorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" required type="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" required type="password" />
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Unable to sign in. Please try again.";
}

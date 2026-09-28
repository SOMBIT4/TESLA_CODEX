"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { PublicUser, UserRole } from "@/lib/api/types";

interface SessionGuardProps {
  requiredRole: UserRole;
  children: ReactNode;
}

export default function SessionGuard({
  requiredRole,
  children,
}: SessionGuardProps) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void getCurrentUser()
      .then((currentUser) => {
        if (isMounted) {
          setUser(currentUser);
        }
      })
      .catch((caughtError) => {
        if (!isMounted) {
          return;
        }

        if (
          caughtError instanceof ApiError &&
          caughtError.code === "UNAUTHENTICATED"
        ) {
          router.replace("/login");
          return;
        }

        setError("Unable to check your session. Please try again.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (user && user.role !== requiredRole) {
      router.replace(user.role === "PASSENGER" ? "/passenger" : "/driver");
    }
  }, [requiredRole, router, user]);

  if (isLoading) {
    return <p role="status">Checking your session…</p>;
  }

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (!user || user.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}

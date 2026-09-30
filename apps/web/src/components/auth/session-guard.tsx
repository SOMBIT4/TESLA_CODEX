"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { PublicUser, UserRole } from "@/lib/api/types";
import { BrandMark } from "@/components/brand/brand-mark";
import { useI18n } from "@/lib/i18n/locale-context";

interface SessionGuardProps {
  requiredRole: UserRole;
  children: ReactNode;
}

export default function SessionGuard({
  requiredRole,
  children,
}: SessionGuardProps) {
  const router = useRouter();
  const { t } = useI18n();
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

        setError(t("session.error"));
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

  if (isLoading || error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <BrandMark
          className={isLoading ? "size-12 animate-drift" : "size-12 opacity-60"}
        />
        {isLoading ? (
          <p
            className="text-sm font-medium text-muted-foreground"
            role="status"
          >
            {t("session.checking")}
          </p>
        ) : (
          <p
            className="max-w-xs text-sm font-medium text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!user || user.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}

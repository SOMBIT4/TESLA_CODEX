"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CarFront } from "lucide-react";
import { logout } from "@/lib/api/auth";
import { useI18n } from "@/lib/i18n/locale-context";
import { Button } from "@/components/ui/button";
import LocaleSwitcher from "@/components/layout/locale-switcher";

export default function AppHeader() {
  const router = useRouter();
  const { t } = useI18n();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <header
      aria-label={t("nav.navigation")}
      className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
          >
            <CarFront className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight sm:text-base">
              {t("app.name")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("app.tagline")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground sm:inline-flex">
            {t("app.bulletSeats")}
          </span>
          <LocaleSwitcher />
          <Button disabled={isLoggingOut} onClick={handleLogout} size="sm" variant="outline">
            {isLoggingOut ? t("nav.signingOut") : t("nav.signOut")}
          </Button>
        </div>
      </div>
    </header>
  );
}

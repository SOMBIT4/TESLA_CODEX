"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CarFront, LogOut, UserRound } from "lucide-react";
import { Brand } from "@/components/brand/brand-mark";
import { logout } from "@/lib/api/auth";
import type { UserRole } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/locale-context";
import { Button } from "@/components/ui/button";
import LocaleSwitcher from "@/components/layout/locale-switcher";

interface AppHeaderProps {
  role?: UserRole;
}

export default function AppHeader({ role }: AppHeaderProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const RoleIcon = role === "DRIVER" ? CarFront : UserRound;

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
      className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md backdrop-saturate-150"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Brand name={t("app.name")} tagline={t("app.tagline")} />

        <div className="flex items-center gap-2 sm:gap-3">
          {role ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground sm:inline-flex">
              <RoleIcon aria-hidden="true" className="size-3.5" />
              {role === "DRIVER" ? t("nav.driver") : t("nav.passenger")}
            </span>
          ) : null}
          <LocaleSwitcher />
          <Button
            aria-label={isLoggingOut ? t("nav.signingOut") : t("nav.signOut")}
            disabled={isLoggingOut}
            onClick={handleLogout}
            size="sm"
            variant="outline"
          >
            <LogOut aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">
              {isLoggingOut ? t("nav.signingOut") : t("nav.signOut")}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}

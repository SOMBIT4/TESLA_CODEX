"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CarFront } from "lucide-react";
import { logout } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";

export default function AppHeader() {
  const router = useRouter();
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
      aria-label="Dhaka Tesla Pool navigation"
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
              Dhaka Tesla Pool
            </p>
            <p className="text-xs text-muted-foreground">
              Shared rides for Dhaka
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground sm:inline-flex">
            Bullet · 3 seats
          </span>
          <Button disabled={isLoggingOut} onClick={handleLogout} size="sm" variant="outline">
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
    </header>
  );
}

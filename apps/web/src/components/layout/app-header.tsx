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
    <header className="flex items-center justify-between border-b bg-card px-6 py-4">
      <div className="flex items-center gap-3">
        <CarFront aria-hidden="true" className="size-5" />
        <div>
          <p className="font-semibold">Dhaka Tesla Pool</p>
          <p className="text-xs text-muted-foreground">Ride with Bullet</p>
        </div>
      </div>
      <Button disabled={isLoggingOut} onClick={handleLogout} variant="outline">
        {isLoggingOut ? "Signing out…" : "Sign out"}
      </Button>
    </header>
  );
}

"use client";

import { CarFront } from "lucide-react";
import SessionGuard from "@/components/auth/session-guard";

export default function DriverPage() {
  return (
    <SessionGuard requiredRole="DRIVER">
      <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
        <section className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <CarFront aria-hidden="true" className="mx-auto size-8" />
          <h1 className="mt-4 text-2xl font-semibold">
            Driver workspace is coming next
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bullet’s driver controls will be available in the driver UI branch.
          </p>
        </section>
      </main>
    </SessionGuard>
  );
}

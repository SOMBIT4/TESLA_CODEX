import type { ReactNode } from "react";
import SessionGuard from "@/components/auth/session-guard";
import AppHeader from "@/components/layout/app-header";

export default function PassengerLayout({ children }: { children: ReactNode }) {
  return (
    <SessionGuard requiredRole="PASSENGER">
      <AppHeader role="PASSENGER" />
      {children}
    </SessionGuard>
  );
}

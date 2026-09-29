import DriverDashboard from "@/components/driver/driver-dashboard";
import SessionGuard from "@/components/auth/session-guard";
import AppHeader from "@/components/layout/app-header";

export default function DriverPage() {
  return (
    <SessionGuard requiredRole="DRIVER">
      <AppHeader />
      <DriverDashboard />
    </SessionGuard>
  );
}

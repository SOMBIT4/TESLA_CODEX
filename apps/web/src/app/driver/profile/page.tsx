"use client";

import { CarFront } from "lucide-react";
import SessionGuard from "@/components/auth/session-guard";
import AppHeader from "@/components/layout/app-header";
import WorkspaceHeading from "@/components/layout/workspace-heading";
import { DriverVehicleProfileCard } from "@/components/profile/driver-vehicle-profile-card";
import { ProfileDetailsCard } from "@/components/profile/profile-details-card";
import { useI18n } from "@/lib/i18n/locale-context";

export default function DriverProfilePage() {
  const { t } = useI18n();

  return (
    <SessionGuard requiredRole="DRIVER">
      <AppHeader role="DRIVER" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <WorkspaceHeading
          icon={<CarFront aria-hidden="true" className="size-4" />}
          label={t("profile.pageLabel")}
          subtitle={t("profile.subtitle")}
          title={t("profile.driverTitle")}
        />
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <ProfileDetailsCard />
          <DriverVehicleProfileCard />
        </div>
      </main>
    </SessionGuard>
  );
}

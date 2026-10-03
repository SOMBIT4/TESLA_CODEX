"use client";

import { UserRound } from "lucide-react";
import { ProfileDetailsCard } from "@/components/profile/profile-details-card";
import WorkspaceHeading from "@/components/layout/workspace-heading";
import { useI18n } from "@/lib/i18n/locale-context";

export default function PassengerProfilePage() {
  const { t } = useI18n();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <WorkspaceHeading
        icon={<UserRound aria-hidden="true" className="size-4" />}
        label={t("profile.pageLabel")}
        subtitle={t("profile.subtitle")}
        title={t("profile.passengerTitle")}
      />
      <div className="max-w-2xl">
        <ProfileDetailsCard />
      </div>
    </main>
  );
}

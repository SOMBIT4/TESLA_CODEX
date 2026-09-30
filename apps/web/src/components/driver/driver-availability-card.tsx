import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DriverPendingAction } from "@/hooks/use-driver-dashboard";
import type { DriverSnapshot } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/locale-context";

interface DriverAvailabilityCardProps {
  snapshot: DriverSnapshot | null;
  pendingAction: DriverPendingAction | null;
  onToggleStatus: () => Promise<void>;
}

export default function DriverAvailabilityCard({
  snapshot,
  pendingAction,
  onToggleStatus,
}: DriverAvailabilityCardProps) {
  const vehicle = snapshot?.vehicle ?? null;
  const { t } = useI18n();
  const isOnline = snapshot?.isOnline ?? false;
  const isPending = pendingAction !== null;
  const statusLabel = isOnline ? t("status.online") : t("status.offline");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t("driver.availability")}
            </p>
            <CardTitle className="mt-1 text-xl">{t("driver.status")}</CardTitle>
          </div>
          <Badge variant={isOnline ? "success" : "muted"}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {vehicle ? (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">
                {t("driver.activeVehicle")}
              </dt>
              <dd className="mt-1 font-medium">{vehicle.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t("common.capacity")}
              </dt>
              <dd className="mt-1 font-medium">
                {vehicle.capacity} {t("common.seats")}
              </dd>
            </div>
          </dl>
        ) : (
          <div>
            <p className="font-medium">{t("driver.noActiveVehicle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("driver.noActiveVehicleHint")}
            </p>
          </div>
        )}

        <Button
          className="mt-6"
          disabled={!vehicle || isPending}
          onClick={() => void onToggleStatus()}
          variant={isOnline ? "outline" : "default"}
        >
          {pendingAction === "toggle-status"
            ? t("driver.updatingStatus")
            : isOnline
              ? t("driver.goOffline")
              : t("driver.goOnline")}
        </Button>
      </CardContent>
    </Card>
  );
}

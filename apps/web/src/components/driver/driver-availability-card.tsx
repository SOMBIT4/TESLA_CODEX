import { CarFront, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Kicker,
} from "@/components/ui/card";
import type { DriverPendingAction } from "@/hooks/use-driver-dashboard";
import type { DriverSnapshot } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

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
  const isToggling = pendingAction === "toggle-status";
  const statusLabel = isOnline ? t("status.online") : t("status.offline");

  return (
    <Card
      className={cn(
        "animate-rise transition-[box-shadow,border-color] duration-500",
        isOnline &&
          "border-success/40 shadow-[0_0_0_4px_hsl(var(--success)/0.08)]",
      )}
      style={{ animationDelay: "60ms" }}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Kicker>{t("driver.availability")}</Kicker>
            <CardTitle className="mt-1 text-xl">{t("driver.status")}</CardTitle>
          </div>
          <Badge live={isOnline} variant={isOnline ? "success" : "muted"}>
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {vehicle ? (
          <div className="flex items-center gap-3.5 rounded-2xl bg-muted/70 p-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink text-paper">
              <CarFront aria-hidden="true" className="size-5" />
            </span>
            <dl className="grid flex-1 grid-cols-2 gap-3">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">
                  {t("driver.activeVehicle")}
                </dt>
                <dd className="mt-0.5 truncate font-semibold">
                  {vehicle.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("common.capacity")}
                </dt>
                <dd className="mt-0.5 font-semibold">
                  {vehicle.capacity} {t("common.seats")}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-input p-4">
            <p className="font-semibold">{t("driver.noActiveVehicle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("driver.noActiveVehicleHint")}
            </p>
          </div>
        )}

        <Button
          className="mt-5 w-full justify-between pr-2"
          disabled={!vehicle || isPending}
          onClick={() => void onToggleStatus()}
          size="lg"
          variant={isOnline ? "outline" : "default"}
        >
          <span className="flex items-center gap-2">
            {isToggling ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : null}
            {isToggling
              ? t("driver.updatingStatus")
              : isOnline
                ? t("driver.goOffline")
                : t("driver.goOnline")}
          </span>
          {/* Switch graphic mirrors the state the button will change. */}
          <span
            aria-hidden="true"
            className={cn(
              "relative h-7 w-12 rounded-full transition-colors duration-300",
              isOnline ? "bg-success" : "bg-white/25",
            )}
          >
            <span
              className={cn(
                "absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform duration-500 ease-spring",
                isOnline ? "translate-x-5" : "translate-x-0",
              )}
            />
          </span>
        </Button>
      </CardContent>
    </Card>
  );
}

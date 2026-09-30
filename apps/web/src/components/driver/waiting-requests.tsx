import { Info, LoaderCircle, Radar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Kicker,
} from "@/components/ui/card";
import { RouteRail } from "@/components/ui/route-rail";
import type { DriverPendingAction } from "@/hooks/use-driver-dashboard";
import { formatTaka } from "@/lib/format/money";
import type { ActivePoolStatus, WaitingRide } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/locale-context";

interface WaitingRequestsProps {
  rides: WaitingRide[];
  isOnline: boolean;
  activePoolStatus: ActivePoolStatus | null;
  pendingAction: DriverPendingAction | null;
  onAcceptRide: (rideId: string) => Promise<void>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 flex items-start gap-2.5 rounded-2xl bg-marigold/[0.14] px-4 py-3 text-sm text-warning-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}

export default function WaitingRequests({
  rides,
  isOnline,
  activePoolStatus,
  pendingAction,
  onAcceptRide,
}: WaitingRequestsProps) {
  const { t } = useI18n();
  const poolIsAccepting =
    activePoolStatus === null || activePoolStatus === "MATCHED";
  const acceptsAreDisabled =
    !isOnline || !poolIsAccepting || pendingAction !== null;

  return (
    <Card className="animate-rise" style={{ animationDelay: "180ms" }}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Kicker>{t("driver.waitingRequests")}</Kicker>
            <CardTitle className="mt-1 text-xl">
              {t("driver.availableRides")}
            </CardTitle>
          </div>
          <Badge
            className="font-mono"
            variant={rides.length > 0 ? "warning" : "muted"}
          >
            {rides.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!isOnline ? <Notice>{t("driver.goOnlineToAccept")}</Notice> : null}
        {!poolIsAccepting ? (
          <Notice>{t("driver.poolClosedForRequests")}</Notice>
        ) : null}

        {rides.length === 0 ? (
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-input px-4 py-5">
            <span
              aria-hidden="true"
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              {isOnline ? (
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              ) : null}
              <Radar className="relative size-[1.15rem]" />
            </span>
            <div>
              <p className="font-semibold">{t("driver.noWaitingRequests")}</p>
              {isOnline ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("driver.watchingRequests")}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <ul
            aria-label={t("driver.waitingRequestsLabel")}
            className="space-y-3"
          >
            {rides.map((ride, index) => (
              <li
                className="flex animate-rise gap-3.5 rounded-2xl border bg-card p-4 transition-shadow duration-300 hover:shadow-card"
                key={ride.id}
                style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
              >
                <RouteRail from={ride.pickupZone} to={ride.destinationZone} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {ride.pickupZone} → {ride.destinationZone}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>
                      {ride.seatsRequested}{" "}
                      {ride.seatsRequested === 1
                        ? t("common.seat")
                        : t("common.seats")}
                    </span>
                    <span
                      aria-hidden="true"
                      className="size-1 rounded-full bg-input"
                    />
                    <span>
                      {t("driver.soloFare")}{" "}
                      <span className="font-mono">
                        {formatTaka(ride.estimatedFarePoysha)}
                      </span>
                    </span>
                  </div>
                  <Button
                    className="mt-3.5"
                    disabled={acceptsAreDisabled}
                    onClick={() => void onAcceptRide(ride.id)}
                    size="sm"
                  >
                    {pendingAction === "accept" ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-3.5 animate-spin"
                      />
                    ) : null}
                    {pendingAction === "accept"
                      ? t("driver.accepting")
                      : t("driver.acceptRide")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

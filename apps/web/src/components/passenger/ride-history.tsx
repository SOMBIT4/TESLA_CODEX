import { Check, History, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RouteRail } from "@/components/ui/route-rail";
import { formatPoysha, formatTaka } from "@/lib/format/money";
import type { Ride } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/locale-context";

interface RideHistoryProps {
  rides: Ride[];
}

function formatCompletionTime(
  completedAt: string,
  locale: "en" | "bn",
): string {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(completedAt));
}

export default function RideHistory({ rides }: RideHistoryProps) {
  const { locale, t } = useI18n();

  if (rides.length === 0) {
    return (
      <section
        aria-labelledby="ride-history-title"
        className="flex items-center gap-4 rounded-[1.375rem] border border-dashed border-input p-6"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <History aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2
            className="text-lg font-bold tracking-[-0.02em]"
            id="ride-history-title"
          >
            {t("passenger.history")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("passenger.noRides")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("passenger.noRidesHint")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="ride-history-title"
      className="rounded-[1.375rem] border border-border/80 bg-card p-5 shadow-card sm:p-7"
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          className="text-lg font-bold tracking-[-0.02em]"
          id="ride-history-title"
        >
          {t("passenger.history")}
        </h2>
        <Badge className="font-mono" variant="muted">
          {rides.length}
        </Badge>
      </div>
      <ul className="mt-4 divide-y divide-border/70">
        {rides.map((ride, index) => {
          const isCancelled = ride.status === "CANCELLED";
          const hasMembershipFare = ride.membershipFarePoysha !== null;
          const fareLabelKey =
            hasMembershipFare && ride.status === "COMPLETED"
              ? "fare.final"
              : "fare.estimatedSolo";
          const farePoysha =
            hasMembershipFare && ride.status === "COMPLETED"
              ? ride.membershipFarePoysha ?? ride.estimatedFarePoysha
              : ride.estimatedFarePoysha;
          const fareDisplay =
            hasMembershipFare && ride.status === "COMPLETED"
              ? formatTaka(farePoysha)
              : formatPoysha(farePoysha);

          return (
            <li
              className="flex animate-rise items-stretch gap-4 py-4"
              key={ride.id}
              style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
            >
              <RouteRail from={ride.pickupZone} to={ride.destinationZone} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="truncate">
                    {ride.pickupZone} {t("common.to")} {ride.destinationZone}
                  </span>
                  <span
                    aria-hidden="true"
                    className={
                      isCancelled
                        ? "flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                        : "flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
                    }
                  >
                    {isCancelled ? (
                      <X className="size-2.5" strokeWidth={3.5} />
                    ) : (
                      <Check className="size-2.5" strokeWidth={3.5} />
                    )}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isCancelled ? t("status.cancelled") : t("status.completed")}
                  {ride.status === "COMPLETED" && ride.completedAt ? (
                    <>
                      {" · "}
                      <time dateTime={ride.completedAt}>
                        {formatCompletionTime(ride.completedAt, locale)}
                      </time>
                    </>
                  ) : null}
                  {" · "}
                  {t(fareLabelKey)}{" "}
                  {fareDisplay}
                </p>
              </div>
              <time
                className="shrink-0 self-start rounded-full bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground"
                dateTime={ride.createdAt}
              >
                {new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-BD", {
                  day: "numeric",
                  month: "short",
                }).format(new Date(ride.createdAt))}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

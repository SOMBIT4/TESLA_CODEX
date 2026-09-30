import { CalendarCheck2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Kicker,
} from "@/components/ui/card";
import { RouteRail } from "@/components/ui/route-rail";
import { zoneColor } from "@/lib/constants/zone-colors";
import { formatPoysha, formatTaka } from "@/lib/format/money";
import type { DriverHistoryPool } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/locale-context";

interface DriverHistoryProps {
  history: DriverHistoryPool[];
}

function formatCompletedAt(value: string, locale: "en" | "bn" = "en"): string {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));
}

export default function DriverHistory({ history }: DriverHistoryProps) {
  const { locale, t } = useI18n();
  const riderCount = history.reduce(
    (total, pool) => total + pool.members.length,
    0,
  );
  const faresPoysha = history.reduce(
    (total, pool) =>
      total +
      pool.members.reduce(
        (poolTotal, member) => poolTotal + member.farePoysha,
        0,
      ),
    0,
  );

  return (
    <section aria-labelledby="driver-history-title">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <Kicker>{t("driver.completedTrips")}</Kicker>
          <h2
            className="mt-1 text-2xl font-extrabold tracking-[-0.03em]"
            id="driver-history-title"
          >
            {t("driver.completedHistory")}
          </h2>
        </div>
        <Badge className="font-mono" variant="muted">
          {history.length}
        </Badge>
      </div>

      {history.length === 0 ? (
        <div className="flex items-center gap-4 rounded-[1.375rem] border border-dashed border-input p-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <CalendarCheck2 aria-hidden="true" className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">
            {t("driver.noCompletedPools")}
          </p>
        </div>
      ) : (
        <>
          <dl className="mb-5 grid grid-cols-3 overflow-hidden rounded-[1.375rem] border bg-ink text-paper">
            {(
              [
                [t("driver.statPools"), String(history.length)],
                [t("driver.statRiders"), String(riderCount)],
                [t("driver.statFares"), formatPoysha(faresPoysha)],
              ] as const
            ).map(([label, value], index) => (
              <div
                className="animate-rise border-white/10 px-4 py-4 sm:px-6 [&:not(:first-child)]:border-l"
                key={label}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <dt className="text-xs text-paper/60">{label}</dt>
                <dd className="mt-1 font-mono text-xl font-semibold sm:text-2xl">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-4 lg:grid-cols-2">
            {history.map((pool, index) => (
              <Card
                className="animate-rise overflow-hidden"
                key={pool.id}
                style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
              >
                <div
                  aria-hidden="true"
                  className="h-1"
                  style={{ backgroundColor: zoneColor(pool.pickupZone) }}
                />
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Kicker>
                        {t("driver.completedPool")} · {pool.vehicle.name}
                      </Kicker>
                      <CardTitle className="mt-1 text-xl">
                        {pool.pickupZone} {t("driver.pool")}
                      </CardTitle>
                    </div>
                    <Badge variant="success">{t("status.completed")}</Badge>
                  </div>
                  <time
                    aria-label={`${t("common.completed")} ${formatCompletedAt(
                      pool.completedAt,
                      locale,
                    )}`}
                    className="font-mono text-xs text-muted-foreground"
                    dateTime={pool.completedAt}
                  >
                    {t("driver.completedAt")}{" "}
                    {formatCompletedAt(pool.completedAt, locale)}
                  </time>
                </CardHeader>
                <CardContent>
                  <dl className="mb-4 flex flex-wrap gap-2 text-sm">
                    <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                      <dt className="text-muted-foreground">
                        {t("common.vehicle")}
                      </dt>
                      <dd className="font-semibold">{pool.vehicle.name}</dd>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                      <dt className="text-muted-foreground">
                        {t("common.capacity")}
                      </dt>
                      <dd className="font-semibold">
                        {pool.vehicle.capacity} {t("common.seats")}
                      </dd>
                    </div>
                  </dl>

                  <ul
                    aria-label={`${pool.pickupZone} ${t(
                      "driver.completedPoolMembers",
                    )}`}
                    className="divide-y divide-border/70 rounded-2xl border"
                  >
                    {pool.members.map((member) => (
                      <li
                        className="flex gap-3.5 p-4"
                        key={`${member.passengerName}-${member.completedAt}`}
                      >
                        <RouteRail
                          from={member.pickupZone}
                          to={member.destinationZone}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold">
                                {member.passengerName}
                              </p>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {member.pickupZone} → {member.destinationZone}
                              </p>
                            </div>
                            <p className="shrink-0 font-mono font-semibold">
                              {formatTaka(member.farePoysha)}
                            </p>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              {member.seatsReserved}{" "}
                              {member.seatsReserved === 1
                                ? t("common.seat")
                                : t("common.seats")}
                            </span>
                            <span>
                              {t("driver.droppedOffAt")}{" "}
                              {formatCompletedAt(member.completedAt, locale)}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

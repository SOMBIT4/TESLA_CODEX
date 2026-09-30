import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTaka } from "@/lib/format/money";
import type { DriverHistoryPool } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/locale-context";

interface DriverHistoryProps {
  history: DriverHistoryPool[];
}

function formatCompletedAt(
  value: string,
  locale: "en" | "bn" = "en",
): string {
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

  return (
    <section aria-labelledby="driver-history-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {t("driver.completedTrips")}
          </p>
          <h2
            className="mt-1 text-2xl font-semibold tracking-tight"
            id="driver-history-title"
          >
            {t("driver.completedHistory")}
          </h2>
        </div>
        <Badge variant="muted">{history.length}</Badge>
      </div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {t("driver.noCompletedPools")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((pool) => (
            <Card key={pool.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("driver.completedPool")} · {pool.vehicle.name}
                    </p>
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
                  className="text-sm text-muted-foreground"
                  dateTime={pool.completedAt}
                >
                  {t("driver.completedAt")}{" "}
                  {formatCompletedAt(pool.completedAt, locale)}
                </time>
              </CardHeader>
              <CardContent>
                <dl className="mb-5 grid grid-cols-2 gap-4 text-sm sm:max-w-sm">
                  <div>
                      <dt className="text-muted-foreground">
                        {t("common.vehicle")}
                      </dt>
                    <dd className="mt-1 font-medium">{pool.vehicle.name}</dd>
                  </div>
                  <div>
                      <dt className="text-muted-foreground">
                        {t("common.capacity")}
                      </dt>
                    <dd className="mt-1 font-medium">
                      {pool.vehicle.capacity} {t("common.seats")}
                    </dd>
                  </div>
                </dl>

                <ul
                  aria-label={`${pool.pickupZone} ${t(
                    "driver.completedPoolMembers",
                  )}`}
                  className="space-y-3"
                >
                  {pool.members.map((member) => (
                    <li
                      className="rounded-lg border bg-muted/20 p-4"
                      key={`${member.passengerName}-${member.completedAt}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{member.passengerName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {member.pickupZone} → {member.destinationZone}
                          </p>
                        </div>
                        <p className="font-semibold">
                          {formatTaka(member.farePoysha)}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

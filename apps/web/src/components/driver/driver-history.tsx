import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTaka } from "@/lib/format/money";
import type { DriverHistoryPool } from "@/lib/api/types";

interface DriverHistoryProps {
  history: DriverHistoryPool[];
}

const completedAtFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

function formatCompletedAt(value: string): string {
  return completedAtFormatter.format(new Date(value));
}

function seatsLabel(seats: number): string {
  return `${seats} ${seats === 1 ? "seat" : "seats"}`;
}

export default function DriverHistory({ history }: DriverHistoryProps) {
  return (
    <section aria-labelledby="driver-history-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Completed trips
          </p>
          <h2
            className="mt-1 text-2xl font-semibold tracking-tight"
            id="driver-history-title"
          >
            Completed pool history
          </h2>
        </div>
        <Badge variant="muted">{history.length}</Badge>
      </div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No completed pools yet.
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
                      Completed pool · {pool.vehicle.name}
                    </p>
                    <CardTitle className="mt-1 text-xl">
                      {pool.pickupZone} pool
                    </CardTitle>
                  </div>
                  <Badge variant="success">Completed</Badge>
                </div>
                <time
                  aria-label={`Completed ${formatCompletedAt(pool.completedAt)}`}
                  className="text-sm text-muted-foreground"
                  dateTime={pool.completedAt}
                >
                  Completed {formatCompletedAt(pool.completedAt)}
                </time>
              </CardHeader>
              <CardContent>
                <dl className="mb-5 grid grid-cols-2 gap-4 text-sm sm:max-w-sm">
                  <div>
                    <dt className="text-muted-foreground">Vehicle</dt>
                    <dd className="mt-1 font-medium">{pool.vehicle.name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Capacity</dt>
                    <dd className="mt-1 font-medium">
                      {pool.vehicle.capacity} seats
                    </dd>
                  </div>
                </dl>

                <ul
                  aria-label={`${pool.pickupZone} completed pool members`}
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
                        <span>{seatsLabel(member.seatsReserved)}</span>
                        <span>
                          Dropped off {formatCompletedAt(member.completedAt)}
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

import { formatPoysha } from "@/lib/format/money";
import type { Ride } from "@/lib/api/types";

interface RideHistoryProps {
  rides: Ride[];
}

export default function RideHistory({ rides }: RideHistoryProps) {
  if (rides.length === 0) {
    return (
      <section
        aria-labelledby="ride-history-title"
        className="rounded-xl border border-dashed p-6"
      >
        <h2 className="text-lg font-semibold" id="ride-history-title">
          Ride history
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">No rides yet</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="ride-history-title"
      className="rounded-xl border bg-card p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold" id="ride-history-title">
        Ride history
      </h2>
      <ul className="mt-4 divide-y">
        {rides.map((ride) => (
          <li
            className="flex items-center justify-between gap-4 py-4"
            key={ride.id}
          >
            <div>
              <p className="font-medium">
                {ride.pickupZone} to {ride.destinationZone}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {ride.status === "CANCELLED" ? "Cancelled" : "Completed"} ·
                Estimated solo fare {formatPoysha(ride.estimatedFarePoysha)}
              </p>
            </div>
            <time
              className="text-right text-sm text-muted-foreground"
              dateTime={ride.createdAt}
            >
              {new Intl.DateTimeFormat("en-BD", {
                day: "numeric",
                month: "short",
              }).format(new Date(ride.createdAt))}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DriverPendingAction } from "@/hooks/use-driver-dashboard";
import { formatTaka } from "@/lib/format/money";
import type { DriverActivePool } from "@/lib/api/types";

interface ActivePoolCardProps {
  pool: DriverActivePool | null;
  pendingAction: DriverPendingAction | null;
  pendingRideId: string | null;
  onArrive: () => Promise<void>;
  onStart: () => Promise<void>;
  onDropOff: (rideId: string) => Promise<void>;
}

function titleCaseStatus(status: DriverActivePool["status"]): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function seatsLabel(seats: number): string {
  return `${seats} ${seats === 1 ? "seat" : "seats"}`;
}

export default function ActivePoolCard({
  pool,
  pendingAction,
  pendingRideId,
  onArrive,
  onStart,
  onDropOff,
}: ActivePoolCardProps) {
  if (!pool) {
    return (
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">
            Active pool
          </p>
          <CardTitle className="mt-1 text-xl">No active pool</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Accept a compatible ride to start a Bullet pool.
          </p>
        </CardContent>
      </Card>
    );
  }

  const availableSeats = pool.vehicle.capacity - pool.occupiedSeats;
  const isPending = pendingAction !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Active pool · {pool.vehicle.name}
            </p>
            <CardTitle className="mt-1 text-xl">
              {pool.pickupZone} pool
            </CardTitle>
          </div>
          <Badge variant={pool.status === "STARTED" ? "success" : "default"}>
            {titleCaseStatus(pool.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {availableSeats} of {pool.vehicle.capacity} seats available
        </p>

        <ul className="mt-5 space-y-3" aria-label="Active pool members">
          {pool.members.map((member) => (
            <li className="rounded-lg border p-4" key={member.rideId}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{member.passengerName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {member.pickupZone} → {member.destinationZone}
                  </p>
                </div>
                <p className="font-medium">{formatTaka(member.farePoysha)}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {seatsLabel(member.seatsReserved)}
              </p>
              {pool.status === "STARTED" ? (
                <Button
                  className="mt-4"
                  disabled={isPending}
                  onClick={() => void onDropOff(member.rideId)}
                  size="sm"
                  variant="outline"
                >
                  {pendingAction === "drop-off" &&
                  pendingRideId === member.rideId
                    ? "Dropping off…"
                    : "Drop off"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        {pool.status === "MATCHED" ? (
          <Button
            className="mt-6"
            disabled={isPending}
            onClick={() => void onArrive()}
          >
            {pendingAction === "arrive" ? "Marking arrived…" : "Mark arrived"}
          </Button>
        ) : null}

        {pool.status === "DRIVER_ARRIVED" ? (
          <Button
            className="mt-6"
            disabled={isPending}
            onClick={() => void onStart()}
          >
            {pendingAction === "start" ? "Starting trip…" : "Start trip"}
          </Button>
        ) : null}

      </CardContent>
    </Card>
  );
}

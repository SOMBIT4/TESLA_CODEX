import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DriverPendingAction } from "@/hooks/use-driver-dashboard";
import { formatTaka } from "@/lib/format/money";
import type { ActivePoolStatus, WaitingRide } from "@/lib/api/types";

interface WaitingRequestsProps {
  rides: WaitingRide[];
  isOnline: boolean;
  activePoolStatus: ActivePoolStatus | null;
  pendingAction: DriverPendingAction | null;
  onAcceptRide: (rideId: string) => Promise<void>;
}

function seatsLabel(seats: number): string {
  return `${seats} ${seats === 1 ? "seat" : "seats"}`;
}

export default function WaitingRequests({
  rides,
  isOnline,
  activePoolStatus,
  pendingAction,
  onAcceptRide,
}: WaitingRequestsProps) {
  const poolIsAccepting =
    activePoolStatus === null || activePoolStatus === "MATCHED";
  const acceptsAreDisabled =
    !isOnline || !poolIsAccepting || pendingAction !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Waiting requests
            </p>
            <CardTitle className="mt-1 text-xl">Available rides</CardTitle>
          </div>
          <Badge variant="default">{rides.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!isOnline ? (
          <p className="mb-4 text-sm text-muted-foreground">
            Go online to accept waiting ride requests.
          </p>
        ) : null}
        {!poolIsAccepting ? (
          <p className="mb-4 text-sm text-muted-foreground">
            This pool cannot accept new rides after arrival.
          </p>
        ) : null}

        {rides.length === 0 ? (
          <p className="text-sm text-muted-foreground">No waiting requests</p>
        ) : (
          <ul className="space-y-3" aria-label="Waiting ride requests">
            {rides.map((ride) => (
              <li className="rounded-lg border p-4" key={ride.id}>
                <p className="font-medium">
                  {ride.pickupZone} → {ride.destinationZone}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span>{seatsLabel(ride.seatsRequested)}</span>
                  <span>Solo fare {formatTaka(ride.estimatedFarePoysha)}</span>
                </div>
                <Button
                  className="mt-4"
                  disabled={acceptsAreDisabled}
                  onClick={() => void onAcceptRide(ride.id)}
                  size="sm"
                >
                  {pendingAction === "accept" ? "Accepting…" : "Accept ride"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

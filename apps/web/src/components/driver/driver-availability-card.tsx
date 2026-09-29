import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DriverPendingAction } from "@/hooks/use-driver-dashboard";
import type { DriverSnapshot } from "@/lib/api/types";

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
  const isOnline = snapshot?.isOnline ?? false;
  const isPending = pendingAction !== null;
  const statusLabel = isOnline ? "Online" : "Offline";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Availability
            </p>
            <CardTitle className="mt-1 text-xl">Driver status</CardTitle>
          </div>
          <Badge variant={isOnline ? "success" : "muted"}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {vehicle ? (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Active vehicle</dt>
              <dd className="mt-1 font-medium">{vehicle.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Capacity</dt>
              <dd className="mt-1 font-medium">{vehicle.capacity} seats</dd>
            </div>
          </dl>
        ) : (
          <div>
            <p className="font-medium">No active vehicle</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Activate a vehicle before going online to accept ride requests.
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
            ? "Updating status…"
            : isOnline
              ? "Go offline"
              : "Go online"}
        </Button>
      </CardContent>
    </Card>
  );
}

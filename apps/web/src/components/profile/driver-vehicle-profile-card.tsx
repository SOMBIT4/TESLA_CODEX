"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { CarFront, LockKeyhole, PencilLine, Save, X } from "lucide-react";
import {
  getActivePool,
  getDriverSnapshot,
  updateDriverVehicle,
} from "@/lib/api/driver";
import { ApiError } from "@/lib/api/client";
import type { DriverSnapshot } from "@/lib/api/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Kicker,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n/locale-context";

export function DriverVehicleProfileCard() {
  const router = useRouter();
  const { t } = useI18n();
  const isMounted = useRef(false);
  const [snapshot, setSnapshot] = useState<DriverSnapshot | null>(null);
  const [hasActivePool, setHasActivePool] = useState(false);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadDriverData = useCallback(
    async (preserveError = false) => {
      setIsLoading(true);
      if (!preserveError) setError(null);

      try {
        const [nextSnapshot, activePool] = await Promise.all([
          getDriverSnapshot(),
          getActivePool(),
        ]);
        if (!isMounted.current) return;
        setSnapshot(nextSnapshot);
        setHasActivePool(activePool !== null);
        setName(nextSnapshot.vehicle?.name ?? "");
        setCapacity(
          nextSnapshot.vehicle ? String(nextSnapshot.vehicle.capacity) : "",
        );
      } catch (caughtError) {
        if (!isMounted.current) return;
        if (
          caughtError instanceof ApiError &&
          caughtError.code === "UNAUTHENTICATED"
        ) {
          router.replace("/login");
          return;
        }
        if (!preserveError) setError(t("profile.vehicleLoadError"));
      } finally {
        if (isMounted.current) setIsLoading(false);
      }
    },
    [router, t],
  );

  useEffect(() => {
    isMounted.current = true;
    void loadDriverData();

    return () => {
      isMounted.current = false;
    };
  }, [loadDriverData]);

  const canEdit = Boolean(
    snapshot?.vehicle && !snapshot.isOnline && !hasActivePool,
  );

  function beginEditing() {
    if (!snapshot?.vehicle || !canEdit) return;
    setName(snapshot.vehicle.name);
    setCapacity(String(snapshot.vehicle.capacity));
    setError(null);
    setSuccess(false);
    setIsEditing(true);
  }

  function cancelEditing() {
    setName(snapshot?.vehicle?.name ?? "");
    setCapacity(snapshot?.vehicle ? String(snapshot.vehicle.capacity) : "");
    setIsEditing(false);
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    const trimmedName = name.trim();
    const parsedCapacity = Number(capacity);
    if (
      trimmedName.length < 2 ||
      trimmedName.length > 100 ||
      !Number.isInteger(parsedCapacity) ||
      parsedCapacity < 1 ||
      parsedCapacity > 4
    ) {
      setError(t("profile.validationError"));
      setSuccess(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updatedSnapshot = await updateDriverVehicle({
        name: trimmedName,
        capacity: parsedCapacity,
      });
      if (!isMounted.current) return;
      setSnapshot(updatedSnapshot);
      setName(updatedSnapshot.vehicle?.name ?? "");
      setCapacity(
        updatedSnapshot.vehicle ? String(updatedSnapshot.vehicle.capacity) : "",
      );
      setIsEditing(false);
      setSuccess(true);
    } catch (caughtError) {
      if (
        caughtError instanceof ApiError &&
        caughtError.code === "UNAUTHENTICATED"
      ) {
        router.replace("/login");
        return;
      }
      if (
        caughtError instanceof ApiError &&
        caughtError.code === "VEHICLE_PROFILE_LOCKED"
      ) {
        setError(t("profile.vehicleLocked"));
        setIsEditing(false);
        await loadDriverData(true);
        return;
      }
      setError(
        caughtError instanceof ApiError && caughtError.status === 400
          ? t("profile.validationError")
          : caughtError instanceof ApiError
            ? caughtError.message
            : t("profile.vehicleSaveError"),
      );
    } finally {
      if (isMounted.current) setIsSaving(false);
    }
  }

  if (isLoading && !snapshot) {
    return <Skeleton className="h-72 w-full" label={t("profile.loading")} />;
  }

  return (
    <Card className="animate-rise">
      <CardHeader>
        <Kicker>{t("driver.activeVehicle")}</Kicker>
        <CardTitle className="flex items-center gap-2">
          <CarFront aria-hidden="true" className="size-5 text-primary" />
          {t("profile.vehicleTitle")}
        </CardTitle>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          {t("profile.vehicleHint")}
        </p>
      </CardHeader>
      <CardContent>
        {error ? <Alert className="mb-4">{error}</Alert> : null}
        {!snapshot?.vehicle ? (
          <div className="rounded-xl border border-dashed border-input bg-muted/35 p-4 text-sm text-muted-foreground">
            {t("profile.noActiveVehicle")}
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="driver-vehicle-name">
                  {t("profile.vehicleName")}
                </Label>
                <Input
                  autoComplete="off"
                  disabled={!isEditing || !canEdit || isSaving}
                  id="driver-vehicle-name"
                  maxLength={100}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                    setSuccess(false);
                  }}
                  required
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-vehicle-capacity">
                  {t("profile.vehicleCapacity")}
                </Label>
                <Input
                  disabled={!isEditing || !canEdit || isSaving}
                  id="driver-vehicle-capacity"
                  max={4}
                  min={1}
                  onChange={(event) => {
                    setCapacity(event.target.value);
                    setError(null);
                    setSuccess(false);
                  }}
                  required
                  step={1}
                  type="number"
                  value={capacity}
                />
              </div>
            </div>

            {!canEdit ? (
              <p className="flex items-start gap-2 rounded-xl bg-muted/55 px-3.5 py-3 text-sm text-muted-foreground">
                <LockKeyhole
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                {t("profile.vehicleLocked")}
              </p>
            ) : null}

            {success ? (
              <p className="text-sm font-medium text-primary" role="status">
                {t("profile.vehicleUpdated")}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-5">
              {isEditing ? (
                <>
                  <Button
                    disabled={isSaving}
                    onClick={cancelEditing}
                    type="button"
                    variant="outline"
                  >
                    <X aria-hidden="true" className="size-4" />
                    {t("profile.cancelEdit")}
                  </Button>
                  <Button disabled={isSaving || !canEdit} type="submit">
                    <Save aria-hidden="true" className="size-4" />
                    {isSaving
                      ? t("profile.savingVehicle")
                      : t("profile.saveVehicle")}
                  </Button>
                </>
              ) : (
                <Button
                  disabled={!canEdit || isLoading}
                  onClick={beginEditing}
                  type="button"
                  variant="outline"
                >
                  <PencilLine aria-hidden="true" className="size-4" />
                  {t("profile.editVehicle")}
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

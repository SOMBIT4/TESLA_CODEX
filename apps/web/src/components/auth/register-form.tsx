"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CarFront, LoaderCircle, UserRound } from "lucide-react";
import PasswordInput from "@/components/auth/password-input";
import { registerDriver, registerPassenger } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

type AccountType = "PASSENGER" | "DRIVER";

// Mirrors MAX_VEHICLE_CAPACITY in the API registration schema.
const VEHICLE_CAPACITY_OPTIONS = [1, 2, 3, 4] as const;
const DEFAULT_VEHICLE_CAPACITY = 3;

export default function RegisterForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("PASSENGER");
  const isDriver = accountType === "DRIVER";

  // Links such as "Register as a driver" preselect the driver account.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("role") === "driver") {
      setAccountType("DRIVER");
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const registration = {
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      };

      if (accountType === "DRIVER") {
        await registerDriver({
          ...registration,
          vehicleName: String(formData.get("vehicleName") ?? ""),
          vehicleCapacity: Number(formData.get("vehicleCapacity") ?? 0),
        });
        router.replace("/driver");
      } else {
        await registerPassenger(registration);
        router.replace("/passenger");
      }
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, t("auth.driverRegistrationError")));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      aria-busy={isSubmitting}
      className="space-y-5"
      onSubmit={handleSubmit}
    >
      <div
        aria-label={t("auth.accountType")}
        className="relative grid grid-cols-2 rounded-2xl bg-muted p-1 ring-1 ring-inset ring-border"
        role="tablist"
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-xl bg-card shadow-card transition-transform duration-500 ease-spring",
            isDriver ? "translate-x-full" : "translate-x-0",
          )}
        />
        {(
          [
            ["PASSENGER", t("auth.passengerAccount"), UserRound],
            ["DRIVER", t("auth.driverAccount"), CarFront],
          ] as const
        ).map(([type, label, Icon]) => {
          const isActive = accountType === type;

          return (
            <button
              aria-selected={isActive}
              className={cn(
                "relative z-10 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              disabled={isSubmitting}
              key={type}
              onClick={() => setAccountType(type)}
              role="tab"
              type="button"
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "size-4 transition-colors",
                  isActive ? "text-primary" : null,
                )}
              />
              {label}
            </button>
          );
        })}
      </div>

      <p
        className="animate-fade text-sm leading-6 text-muted-foreground"
        key={accountType}
      >
        {isDriver ? t("auth.driverHint") : t("auth.passengerHint")}
      </p>

      <div className="space-y-2">
        <Label htmlFor="name">{t("auth.name")}</Label>
        <Input
          autoComplete="name"
          disabled={isSubmitting}
          id="name"
          name="name"
          placeholder={t("auth.yourName")}
          required
          type="text"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input
          autoComplete="email"
          disabled={isSubmitting}
          id="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <PasswordInput
          autoComplete="new-password"
          disabled={isSubmitting}
          id="password"
          name="password"
          required
        />
      </div>

      {isDriver ? (
        <fieldset className="animate-slide-down space-y-4 rounded-2xl border border-dashed border-input bg-card/60 p-4">
          <legend className="sr-only">{t("auth.vehicleDetails")}</legend>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-marigold/20 text-warning-foreground">
              <CarFront aria-hidden="true" className="size-[1.1rem]" />
            </span>
            <div>
              <p aria-hidden="true" className="text-sm font-semibold">
                {t("auth.vehicleDetails")}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {t("auth.vehicleDetailsHint")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicleName">{t("auth.vehicleName")}</Label>
            <Input
              autoComplete="organization"
              defaultValue="Bullet"
              disabled={isSubmitting}
              id="vehicleName"
              name="vehicleName"
              placeholder={t("auth.vehiclePlaceholder")}
              required
              type="text"
            />
          </div>

          {/* A fixed choice keeps capacity within the four-seat limit the
              API enforces; there is no free-typed number to overshoot. */}
          <div aria-labelledby="vehicle-capacity-label" role="radiogroup">
            <span
              className="text-[0.8125rem] font-semibold leading-none text-foreground/85"
              id="vehicle-capacity-label"
            >
              {t("auth.vehicleSeats")}
            </span>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {VEHICLE_CAPACITY_OPTIONS.map((seatCount) => (
                <label
                  className="flex h-11 cursor-pointer items-center justify-center rounded-xl border bg-card font-mono text-sm font-semibold transition-[border-color,background-color,box-shadow,transform] duration-200 hover:border-foreground/30 active:scale-[0.97] has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:text-secondary-foreground has-[:checked]:shadow-[inset_0_0_0_1px_hsl(var(--primary))] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                  key={seatCount}
                >
                  <input
                    className="sr-only"
                    defaultChecked={seatCount === DEFAULT_VEHICLE_CAPACITY}
                    disabled={isSubmitting}
                    name="vehicleCapacity"
                    type="radio"
                    value={seatCount}
                  />
                  {seatCount}
                </label>
              ))}
            </div>
          </div>
        </fieldset>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}
      <Button
        className="group w-full"
        disabled={isSubmitting}
        size="lg"
        type="submit"
        variant="ink"
      >
        {isSubmitting ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        {isSubmitting
          ? t("auth.creatingAccount")
          : isDriver
            ? t("auth.createDriverAccount")
            : t("auth.createPassengerAccount")}
        {isSubmitting ? null : (
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1"
          />
        )}
      </Button>
    </form>
  );
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

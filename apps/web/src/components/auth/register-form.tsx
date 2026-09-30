"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { registerDriver, registerPassenger } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/locale-context";

type AccountType = "PASSENGER" | "DRIVER";

export default function RegisterForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("PASSENGER");

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
    <form aria-busy={isSubmitting} className="space-y-5" onSubmit={handleSubmit}>
      <div
        aria-label={t("auth.accountType")}
        className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
        role="tablist"
      >
        {([
          ["PASSENGER", t("auth.passengerAccount")],
          ["DRIVER", t("auth.driverAccount")],
        ] as const).map(([type, label]) => {
          const isActive = accountType === type;

          return (
            <button
              aria-selected={isActive}
              className={
                isActive
                  ? "rounded-lg bg-background px-3 py-2.5 text-sm font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  : "rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              }
              disabled={isSubmitting}
              key={type}
              onClick={() => setAccountType(type)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="text-sm leading-6 text-muted-foreground">
        {accountType === "DRIVER"
          ? t("auth.driverHint")
          : t("auth.passengerHint")}
      </p>

      <div className="space-y-2">
        <Label htmlFor="name">{t("auth.name")}</Label>
        <Input
          autoComplete="name"
          id="name"
          name="name"
          placeholder={t("auth.yourName")}
          required
          type="text"
          disabled={isSubmitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input
          autoComplete="email"
          id="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
          disabled={isSubmitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <div className="relative">
          <Input
            autoComplete="new-password"
            className="pr-11"
            id="password"
            name="password"
            required
            type={isPasswordVisible ? "text" : "password"}
            disabled={isSubmitting}
          />
          <button
            aria-label={
              isPasswordVisible
                ? t("auth.hidePassword")
                : t("auth.showPassword")
            }
            className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            disabled={isSubmitting}
            type="button"
          >
            {isPasswordVisible ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      </div>

      {accountType === "DRIVER" ? (
        <div className="space-y-4 rounded-xl border border-border/80 bg-muted/40 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("auth.vehicleDetails")}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("auth.vehicleDetailsHint")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_0.6fr]">
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
            <div className="space-y-2">
              <Label htmlFor="vehicleCapacity">{t("auth.vehicleSeats")}</Label>
              <Input
                defaultValue={3}
                disabled={isSubmitting}
                id="vehicleCapacity"
                max={8}
                min={1}
                name="vehicleCapacity"
                required
                type="number"
              />
            </div>
          </div>
        </div>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting
          ? t("auth.creatingAccount")
          : accountType === "DRIVER"
            ? t("auth.createDriverAccount")
            : t("auth.createPassengerAccount")}
      </Button>
    </form>
  );
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

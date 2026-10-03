"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, Save, UserRound } from "lucide-react";
import { getCurrentUser, updateCurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { PublicUser } from "@/lib/api/types";
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

export function ProfileDetailsCard() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void getCurrentUser()
      .then((currentUser) => {
        if (!isMounted) return;
        setUser(currentUser);
        setName(currentUser.name);
        setPhoneNumber(currentUser.phoneNumber ?? "");
      })
      .catch((caughtError: unknown) => {
        if (!isMounted) return;
        if (
          caughtError instanceof ApiError &&
          caughtError.code === "UNAUTHENTICATED"
        ) {
          router.replace("/login");
          return;
        }
        setError(t("profile.loadError"));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const normalizedPhone = phoneNumber.trim().replace(/[\s-]/g, "");
    if (name.trim().length < 2) {
      setError(t("profile.nameRequired"));
      setSuccess(false);
      return;
    }
    if (
      normalizedPhone &&
      !/^(?:01[3-9]\d{8}|\+8801[3-9]\d{8})$/.test(normalizedPhone)
    ) {
      setError(t("profile.phoneInvalid"));
      setSuccess(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updatedUser = await updateCurrentUser({
        name: name.trim(),
        phoneNumber: normalizedPhone || null,
      });
      setUser(updatedUser);
      setName(updatedUser.name);
      setPhoneNumber(updatedUser.phoneNumber ?? "");
      setSuccess(true);
    } catch (caughtError) {
      if (
        caughtError instanceof ApiError &&
        caughtError.code === "UNAUTHENTICATED"
      ) {
        router.replace("/login");
        return;
      }
      setError(
        caughtError instanceof ApiError && caughtError.status === 400
          ? t("profile.validationError")
          : caughtError instanceof ApiError
            ? caughtError.message
            : t("profile.saveError"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-72 w-full" label={t("profile.loading")} />;
  }

  if (!user) {
    return error ? <Alert>{error}</Alert> : null;
  }

  return (
    <Card className="animate-rise">
      <CardHeader>
        <Kicker>{t("profile.pageLabel")}</Kicker>
        <CardTitle className="flex items-center gap-2">
          <UserRound aria-hidden="true" className="size-5 text-primary" />
          {t("profile.personalDetails")}
        </CardTitle>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          {t("profile.personalHint")}
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="profile-name">{t("profile.fullName")}</Label>
            <Input
              autoComplete="name"
              id="profile-name"
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
            <Label htmlFor="profile-email">{t("profile.emailAddress")}</Label>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoComplete="email"
                className="pl-10 text-muted-foreground"
                id="profile-email"
                readOnly
                type="email"
                value={user.email}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("profile.subtitle")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-phone">{t("profile.phoneOptional")}</Label>
            <div className="relative">
              <Phone
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoComplete="tel"
                className="pl-10"
                id="profile-phone"
                inputMode="tel"
                maxLength={24}
                onChange={(event) => {
                  setPhoneNumber(event.target.value);
                  setError(null);
                  setSuccess(false);
                }}
                type="tel"
                value={phoneNumber}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("profile.phoneHint")}
            </p>
          </div>

          {error ? <Alert>{error}</Alert> : null}
          {success ? (
            <p
              className="flex items-center gap-2 text-sm font-medium text-primary"
              role="status"
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-primary"
              />
              {t("profile.updated")}
            </p>
          ) : null}

          <div className="flex justify-end border-t border-border/70 pt-5">
            <Button disabled={isSaving} type="submit">
              <Save aria-hidden="true" className="size-4" />
              {isSaving ? t("profile.saving") : t("profile.saveChanges")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

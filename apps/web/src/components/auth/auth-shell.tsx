"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AuthIllustration from "@/components/auth/auth-illustration";
import { BrandMark } from "@/components/brand/brand-mark";
import LocaleSwitcher from "@/components/layout/locale-switcher";
import { useI18n } from "@/lib/i18n/locale-context";

interface AuthShellProps {
  mode: "login" | "register";
  children: ReactNode;
}

export default function AuthShell({ mode, children }: AuthShellProps) {
  const { t } = useI18n();
  const isLogin = mode === "login";

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="flex min-h-screen flex-col px-5 py-5 sm:px-10 lg:px-14 xl:px-20">
        <div className="flex items-center justify-between gap-4">
          <Link
            className="group inline-flex items-center gap-2.5 rounded-full py-1 pr-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href="/"
          >
            <BrandMark className="size-9" />
            <ArrowLeft
              aria-hidden="true"
              className="size-4 transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
            />
            <span>{t("auth.backHome")}</span>
          </Link>
          <LocaleSwitcher />
        </div>

        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-12">
          <div className="animate-rise">
            <p className="text-sm font-semibold text-primary">
              {t(isLogin ? "auth.loginEyebrow" : "auth.registerEyebrow")}
            </p>
            <h1 className="mt-2 text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[2.6rem]">
              {t(isLogin ? "auth.loginTitle" : "auth.registerTitle")}
            </h1>
            <p className="mt-4 text-[0.95rem] leading-7 text-muted-foreground">
              {t(
                isLogin ? "auth.loginDescription" : "auth.registerDescription",
              )}
            </p>
          </div>

          <div className="mt-8 animate-rise" style={{ animationDelay: "90ms" }}>
            {children}
          </div>

          <p
            className="mt-8 animate-fade text-sm text-muted-foreground"
            style={{ animationDelay: "200ms" }}
          >
            {isLogin ? t("auth.newHere") : t("auth.alreadyRegistered")}{" "}
            <Link
              className="font-semibold text-foreground underline decoration-marigold decoration-2 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
              href={isLogin ? "/register" : "/login"}
            >
              {isLogin ? t("auth.createAccount") : t("auth.signIn")}
            </Link>
          </p>
        </div>
      </section>

      <aside
        aria-label={t("auth.routePreview")}
        className="hidden p-3 lg:block"
      >
        <AuthIllustration />
      </aside>
    </main>
  );
}

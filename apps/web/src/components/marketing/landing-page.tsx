"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { Brand } from "@/components/brand/brand-mark";
import DhakaRouteMap from "@/components/brand/dhaka-route-map";
import LocaleSwitcher from "@/components/layout/locale-switcher";
import Reveal from "@/components/motion/reveal";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZONE_COLORS } from "@/lib/constants/zone-colors";
import { useI18n } from "@/lib/i18n/locale-context";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const steps: { title: MessageKey; text: MessageKey; color: string }[] = [
  {
    title: "landing.step1Title",
    text: "landing.step1Text",
    color: ZONE_COLORS.Banani,
  },
  {
    title: "landing.step2Title",
    text: "landing.step2Text",
    color: ZONE_COLORS["Gulshan 1"],
  },
  {
    title: "landing.step3Title",
    text: "landing.step3Text",
    color: ZONE_COLORS.Mohakhali,
  },
];

const driverPoints: MessageKey[] = [
  "landing.driverPoint1",
  "landing.driverPoint2",
  "landing.driverPoint3",
];

export default function LandingPage() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen overflow-x-clip">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-5 sm:px-6 lg:px-8">
        <Link
          className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
          href="/"
        >
          <Brand name={t("app.name")} tagline={t("app.rideWithBullet")} />
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <Link
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            href="/login"
          >
            {t("landing.signIn")}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:px-8 lg:pb-28 lg:pt-20">
        <div className="max-w-xl">
          <p className="inline-flex animate-rise items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-[0.8125rem] font-medium text-muted-foreground shadow-card">
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-success" />
              <span className="relative size-2 rounded-full bg-success" />
            </span>
            {t("landing.liveNote")}
          </p>

          <h1
            className="mt-7 animate-rise text-[2.75rem] font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-[4.25rem]"
            style={{ animationDelay: "80ms" }}
          >
            {t("landing.title")}
          </h1>

          <p
            className="mt-6 max-w-md animate-rise text-lg leading-8 text-muted-foreground"
            style={{ animationDelay: "160ms" }}
          >
            {t("landing.description")}
          </p>

          <div
            className="mt-9 flex animate-rise flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              className={cn(
                buttonVariants({ size: "lg", variant: "ink" }),
                "group",
              )}
              href="/register"
            >
              {t("landing.startRiding")}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1"
              />
            </Link>
            <Link
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
              href="/login"
            >
              {t("landing.accountCta")}
            </Link>
          </div>

          {/* Fare stub: the real numbers for the featured route. */}
          <div
            className="mt-12 max-w-md animate-rise overflow-hidden rounded-2xl border bg-card shadow-card"
            style={{ animationDelay: "320ms" }}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <p className="text-sm font-semibold">
                {t("landing.ticketRoute")}
              </p>
              <span className="font-mono text-xs text-muted-foreground">
                {t("landing.ticketDistance")}
              </span>
            </div>
            <div className="ticket-edge h-3 border-t border-dashed" />
            <dl className="grid grid-cols-3 divide-x px-1 pb-4 pt-1">
              <div className="px-4">
                <dt className="text-xs text-muted-foreground">
                  {t("landing.soloLabel")}
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold text-muted-foreground line-through decoration-1">
                  ৳86
                </dd>
              </div>
              <div className="px-4">
                <dt className="text-xs text-muted-foreground">
                  {t("landing.pooledLabel")}
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold">৳71</dd>
              </div>
              <div className="px-4">
                <dt className="text-xs text-muted-foreground">
                  {t("landing.youSave")}
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold text-success">
                  ৳15
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Route board */}
        <div
          className="relative mx-auto w-full max-w-[40rem] animate-rise lg:mr-0"
          style={{ animationDelay: "120ms" }}
        >
          <div className="grid-texture relative overflow-hidden rounded-[2rem] bg-ink p-5 text-paper shadow-lift sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.8125rem] font-medium text-paper/55">
                  {t("landing.routePreview")}
                </p>
                <p className="mt-1 text-xl font-bold tracking-[-0.02em]">
                  {t("landing.routeTitle")}
                </p>
              </div>
              <Badge
                className="bg-white/10 text-paper ring-white/15"
                live
                variant="ink"
              >
                {t("app.bulletSeats")}
              </Badge>
            </div>

            <DhakaRouteMap
              ariaLabel={t("landing.routeAria")}
              className="mt-4"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-sm">
              <span className="text-paper/60">
                {t("landing.pickupDestination")}
              </span>
              <span className="font-mono font-semibold">
                {t("landing.fromFare")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How a pool works, laid out as stops on a line */}
      <section className="border-y bg-card">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <Reveal className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">
              {t("landing.howTitle")}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              {t("landing.howSubtitle")}
            </p>
          </Reveal>

          <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            <span
              aria-hidden="true"
              className="absolute left-[11px] top-3 h-[calc(100%-1.5rem)] w-[3px] rounded-full md:left-3 md:right-3 md:h-[3px] md:w-auto"
              style={{
                backgroundImage: `linear-gradient(90deg, ${steps
                  .map((step) => step.color)
                  .join(", ")})`,
              }}
            />
            {steps.map((step, index) => (
              <Reveal
                as="li"
                className="relative pl-12 md:pl-0 md:pt-12"
                delay={index * 120}
                key={step.title}
              >
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 flex size-[25px] items-center justify-center rounded-full border-[3px] bg-card font-mono text-[0.7rem] font-semibold"
                  style={{ borderColor: step.color, color: step.color }}
                >
                  {index + 1}
                </span>
                <h3 className="text-lg font-bold tracking-[-0.02em]">
                  {t(step.title)}
                </h3>
                <p className="mt-2 max-w-sm leading-7 text-muted-foreground">
                  {t(step.text)}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Drivers */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <Reveal className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-primary-foreground sm:px-12 lg:py-16">
          <svg
            aria-hidden="true"
            className="absolute -right-10 -top-6 hidden h-[130%] opacity-25 lg:block"
            fill="none"
            viewBox="0 0 300 300"
          >
            <path
              className="animate-dash"
              d="M20 280 C 90 280, 80 150, 150 150 S 210 20, 290 20"
              stroke="white"
              strokeDasharray="4 10"
              strokeLinecap="round"
              strokeWidth="3"
            />
            <circle cx="20" cy="280" fill={ZONE_COLORS["Gulshan 1"]} r="9" />
            <circle cx="150" cy="150" fill="white" r="7" />
            <circle cx="290" cy="20" fill={ZONE_COLORS.Banani} r="9" />
          </svg>

          <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="max-w-xl">
              <h2 className="text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">
                {t("landing.driverTitle")}
              </h2>
              <p className="mt-4 text-lg leading-8 text-primary-foreground/80">
                {t("landing.driverText")}
              </p>
              <Link
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "group mt-8 bg-paper text-ink hover:bg-white",
                )}
                href="/register?role=driver"
              >
                {t("landing.driverCta")}
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
            </div>
            <ul className="space-y-3">
              {driverPoints.map((point) => (
                <li
                  className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5 text-[0.95rem] font-medium ring-1 ring-inset ring-white/15"
                  key={point}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-marigold text-ink">
                    <Check
                      aria-hidden="true"
                      className="size-3.5"
                      strokeWidth={3}
                    />
                  </span>
                  {t(point)}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="font-semibold text-foreground">{t("app.name")}</p>
          <p>{t("landing.footer")}</p>
        </div>
      </footer>
    </main>
  );
}

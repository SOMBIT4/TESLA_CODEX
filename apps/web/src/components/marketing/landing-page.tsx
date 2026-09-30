import Link from "next/link";
import { ArrowRight, CarFront, Route, ShieldCheck, UsersRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const highlights = [
  {
    icon: Route,
    title: "Clear routes",
    text: "Choose from the Dhaka zones you actually travel through.",
  },
  {
    icon: UsersRound,
    title: "Shared by design",
    text: "Bullet keeps compatible passengers moving together.",
  },
  {
    icon: ShieldCheck,
    title: "Straightforward fares",
    text: "See the estimate first and follow every ride state.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pb-24 sm:pt-8 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <CarFront aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">Dhaka Tesla Pool</p>
              <p className="text-xs text-muted-foreground">Ride with Bullet</p>
            </div>
          </div>
          <Link
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            href="/login"
          >
            Sign in
          </Link>
        </div>

        <div className="grid items-center gap-12 pb-4 pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:pt-24">
          <div className="max-w-xl">
            <span className="inline-flex items-center rounded-full bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-accent-foreground">
              Dhaka-first pooling
            </span>
            <h1 className="mt-6 max-w-lg text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-6xl">
              Share a smarter ride across Dhaka.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
              One Bullet, fewer empty seats, and a clear fare before the ride
              starts. Built for the routes people use every day.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className={cn(buttonVariants({ size: "lg" }), "group")}
                href="/register"
              >
                Start riding
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
                href="/login"
              >
                I already have an account
              </Link>
            </div>

            <dl className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t pt-6">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Seats</dt>
                <dd className="mt-1 text-xl font-bold">3</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Zones</dt>
                <dd className="mt-1 text-xl font-bold">9</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Focus</dt>
                <dd className="mt-1 text-xl font-bold">Dhaka</dd>
              </div>
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-2xl lg:mr-0">
            <div className="absolute -left-8 top-12 size-36 rounded-full bg-indigo-200/60 blur-3xl" />
            <div className="absolute -bottom-10 right-8 size-44 rounded-full bg-teal-200/70 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 p-3 shadow-xl shadow-slate-900/10">
              <div className="rounded-[1.5rem] bg-slate-900 px-5 pb-5 pt-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Route preview
                    </p>
                    <p className="mt-1 text-lg font-semibold">A better way through the rush</p>
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                    Bullet · 3 seats
                  </span>
                </div>

                <svg
                  aria-label="Dhaka route from Banani to Mohakhali through Gulshan 1"
                  className="mt-5 h-auto w-full"
                  role="img"
                  viewBox="0 0 520 300"
                >
                  <defs>
                    <linearGradient id="route-line" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0" stopColor="#818cf8" />
                      <stop offset="1" stopColor="#2dd4bf" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M72 210 C126 168 128 92 228 92 S315 220 438 142"
                    fill="none"
                    stroke="#334155"
                    strokeDasharray="7 10"
                    strokeWidth="2"
                  />
                  <path
                    d="M72 210 C126 168 128 92 228 92 S315 220 438 142"
                    fill="none"
                    stroke="url(#route-line)"
                    strokeLinecap="round"
                    strokeWidth="6"
                  />
                  <circle cx="72" cy="210" fill="#818cf8" r="12" />
                  <circle cx="228" cy="92" fill="#fbbf24" r="10" />
                  <circle cx="438" cy="142" fill="#2dd4bf" r="12" />
                  <circle cx="72" cy="210" fill="#0f172a" r="4" />
                  <circle cx="438" cy="142" fill="#0f172a" r="4" />
                  <text fill="#cbd5e1" fontSize="16" fontWeight="600" x="52" y="250">
                    Banani
                  </text>
                  <text fill="#cbd5e1" fontSize="16" fontWeight="600" x="192" y="62">
                    Gulshan 1
                  </text>
                  <text fill="#cbd5e1" fontSize="16" fontWeight="600" x="398" y="180">
                    Mohakhali
                  </text>
                </svg>

                <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                  <span className="text-slate-400">Pickup → destination</span>
                  <span className="font-semibold text-white">2 km · from 71.00 Tk</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-card/70">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
          {highlights.map(({ icon: Icon, title, text }) => (
            <article className="rounded-2xl border bg-background/70 p-5" key={title}>
              <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </div>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

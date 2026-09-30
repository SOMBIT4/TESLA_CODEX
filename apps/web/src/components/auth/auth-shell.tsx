import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CarFront } from "lucide-react";
import AuthIllustration from "@/components/auth/auth-illustration";
import { Card, CardContent } from "@/components/ui/card";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-background px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <section className="mx-auto w-full max-w-xl">
          <Link
            className="inline-flex items-center gap-2 rounded-lg text-sm font-bold tracking-tight text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
            href="/"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CarFront aria-hidden="true" className="size-4" />
            </span>
            <span>Back to home</span>
          </Link>

          <div className="mt-10 sm:mt-14">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-[-0.04em] sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
              {description}
            </p>
          </div>

          <Card className="mt-8 border-white/80 shadow-lg shadow-slate-900/5">
            <CardContent className="p-6 sm:p-8">{children}</CardContent>
          </Card>

          <div className="mt-5 text-sm text-muted-foreground">{footer}</div>
        </section>

        <aside className="hidden lg:block" aria-label="Dhaka route preview">
          <AuthIllustration />
          <div className="mt-5 flex items-center gap-2 px-2 text-sm text-muted-foreground">
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span>Start with a route you know.</span>
          </div>
        </aside>
      </div>
    </main>
  );
}

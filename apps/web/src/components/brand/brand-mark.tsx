import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

/**
 * Original pool mark: a route bend carrying three shared seats. Drawn in-repo
 * so it never borrows from any vehicle maker's identity.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-10 shrink-0", className)}
      fill="none"
      viewBox="0 0 40 40"
    >
      <rect fill="hsl(var(--ink))" height="40" rx="12" width="40" />
      <path
        d="M9 27.5c5.5 0 6-15 11-15s5.5 15 11 15"
        stroke="hsl(var(--paper))"
        strokeLinecap="round"
        strokeOpacity="0.28"
        strokeWidth="3"
      />
      <circle cx="9.5" cy="27.5" fill="#E8562F" r="3.4" />
      <circle cx="20" cy="12.5" fill="#E9A20C" r="3.4" />
      <circle cx="30.5" cy="27.5" fill="#1DB184" r="3.4" />
    </svg>
  );
}

interface BrandProps {
  name: string;
  tagline?: string;
  className?: string;
}

export function Brand({ name, tagline, className }: BrandProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark className="transition-transform duration-500 ease-spring group-hover:-rotate-6" />
      <div className="leading-tight">
        <p className="text-[0.95rem] font-extrabold tracking-[-0.02em]">
          {name}
        </p>
        {tagline ? (
          <p className="text-xs text-muted-foreground">{tagline}</p>
        ) : null}
      </div>
    </div>
  );
}

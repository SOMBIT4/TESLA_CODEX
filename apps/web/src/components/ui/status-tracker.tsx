import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusTrackerProps {
  label: string;
  steps: string[];
  /** Index of the step the ride or pool is currently in. */
  current: number;
  className?: string;
}

/**
 * Horizontal progress through a ride's lifecycle. Every step is labelled in
 * text and the current one is marked with aria-current, so progress never
 * relies on colour alone.
 */
export function StatusTracker({
  label,
  steps,
  current,
  className,
}: StatusTrackerProps) {
  return (
    <ol
      aria-label={label}
      className={cn("grid gap-1", className)}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => {
        const isDone = index < current;
        const isCurrent = index === current;
        const isLast = index === steps.length - 1;

        return (
          <li
            aria-current={isCurrent ? "step" : undefined}
            className="min-w-0"
            key={step}
          >
            <div className="flex items-center">
              <span
                aria-hidden="true"
                className={cn(
                  "relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-500",
                  isDone && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-card",
                  !isDone && !isCurrent && "border-border bg-muted",
                )}
              >
                {isDone ? (
                  <Check className="size-3.5 animate-pop" strokeWidth={3} />
                ) : null}
                {isCurrent ? (
                  <>
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
                    <span className="size-2 rounded-full bg-primary" />
                  </>
                ) : null}
              </span>
              {isLast ? null : (
                <span
                  aria-hidden="true"
                  className="mx-1.5 h-[3px] flex-1 overflow-hidden rounded-full bg-muted"
                >
                  <span
                    className="block h-full origin-left rounded-full bg-primary transition-transform duration-700 ease-out"
                    style={{ transform: `scaleX(${isDone ? 1 : 0})` }}
                  />
                </span>
              )}
            </div>
            <span
              className={cn(
                "mt-2 block pr-2 text-[0.75rem] font-medium leading-snug",
                isCurrent ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

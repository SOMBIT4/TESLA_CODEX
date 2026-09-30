import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
  {
    variants: {
      variant: {
        default: "bg-sky/10 text-[hsl(211_70%_34%)] ring-sky/25",
        success: "bg-success/10 text-success ring-success/25",
        warning: "bg-marigold/20 text-warning-foreground ring-marigold/40",
        muted: "bg-muted text-muted-foreground ring-border",
        destructive: "bg-destructive/10 text-destructive ring-destructive/25",
        ink: "bg-ink text-paper ring-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Shows a pulsing dot for states that are still changing. */
  live?: boolean;
}

function Badge({ className, variant, live, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {live !== undefined ? (
        <span aria-hidden="true" className="relative flex size-1.5">
          {live ? (
            <span className="absolute inset-0 animate-ping rounded-full bg-current" />
          ) : null}
          <span className="relative size-1.5 rounded-full bg-current" />
        </span>
      ) : null}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };

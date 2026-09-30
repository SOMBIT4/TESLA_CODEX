import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex animate-slide-down items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-6",
  {
    variants: {
      variant: {
        destructive:
          "border-destructive/25 bg-destructive/[0.07] text-[hsl(8_70%_36%)]",
        warning:
          "border-marigold/40 bg-marigold/[0.14] text-warning-foreground",
      },
    },
    defaultVariants: {
      variant: "destructive",
    },
  },
);

export interface AlertProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, children, role = "alert", ...props }, ref) => {
    const Icon = variant === "warning" ? Info : AlertCircle;

    return (
      <div
        className={cn(alertVariants({ variant }), className)}
        ref={ref}
        role={role}
        {...props}
      >
        <Icon aria-hidden="true" className="mt-1 size-4 shrink-0" />
        <div className="min-w-0">{children}</div>
      </div>
    );
  },
);
Alert.displayName = "Alert";

export { Alert };

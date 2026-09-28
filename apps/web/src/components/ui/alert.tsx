import * as React from "react";
import { cn } from "@/lib/utils";

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800",
      className,
    )}
    ref={ref}
    role="alert"
    {...props}
  />
));
Alert.displayName = "Alert";

export { Alert };

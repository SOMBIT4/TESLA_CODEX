import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    <label
      className={cn(
        "text-[0.8125rem] font-semibold leading-none text-foreground/85",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export { Label };

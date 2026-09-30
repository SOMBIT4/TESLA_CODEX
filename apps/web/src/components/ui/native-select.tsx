import * as React from "react";
import { ChevronDown } from "lucide-react";
import { fieldClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NativeSelectProps extends React.ComponentProps<"select"> {
  /** Optional element shown at the start of the field, e.g. a zone dot. */
  leading?: React.ReactNode;
}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, leading, children, ...props }, ref) => (
    <div className="relative">
      {leading ? (
        <span className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center">
          {leading}
        </span>
      ) : null}
      <select
        className={cn(
          fieldClassName,
          "cursor-pointer appearance-none pr-10 font-medium",
          leading ? "pl-10" : null,
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  ),
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };

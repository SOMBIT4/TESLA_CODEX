import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClassName =
  "flex h-12 w-full rounded-xl border border-input bg-card px-3.5 text-[0.95rem] text-foreground shadow-[inset_0_1px_2px_hsl(var(--ink)/0.05)] transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/70 hover:border-foreground/35 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-70";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      className={cn(fieldClassName, className)}
      ref={ref}
      type={type}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };

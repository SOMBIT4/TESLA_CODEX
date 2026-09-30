import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
}

const shimmerClassName =
  "animate-shimmer rounded-xl bg-[linear-gradient(90deg,hsl(var(--muted))_0%,hsl(var(--accent))_50%,hsl(var(--muted))_100%)] bg-[length:200%_100%]";

function Skeleton({ className, label = "Loading", ...props }: SkeletonProps) {
  return (
    <div
      aria-label={label}
      className={cn(shimmerClassName, className)}
      role="status"
      {...props}
    />
  );
}

/** Decorative placeholder block; pair it with a single textual status. */
function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn(shimmerClassName, className)} />;
}

export { Skeleton, SkeletonBlock };

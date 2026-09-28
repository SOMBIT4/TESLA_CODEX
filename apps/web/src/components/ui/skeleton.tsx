import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
}

function Skeleton({ className, label = "Loading", ...props }: SkeletonProps) {
  return (
    <div
      aria-label={label}
      className={cn("animate-pulse rounded-md bg-muted", className)}
      role="status"
      {...props}
    />
  );
}

export { Skeleton };

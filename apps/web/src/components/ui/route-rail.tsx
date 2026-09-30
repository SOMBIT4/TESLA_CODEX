import { zoneColor } from "@/lib/constants/zone-colors";
import { cn } from "@/lib/utils";

interface ZoneDotProps {
  zone: string;
  className?: string;
  hollow?: boolean;
}

export function ZoneDot({ zone, className, hollow }: ZoneDotProps) {
  const color = zoneColor(zone);

  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={
        hollow
          ? { boxShadow: `inset 0 0 0 2.5px ${color}` }
          : { backgroundColor: color }
      }
    />
  );
}

interface RouteRailProps {
  from: string;
  to: string;
  className?: string;
}

/**
 * Decorative vertical rail joining a pickup (solid) to a destination
 * (hollow) stop in their zone colours. The route itself is always written
 * out in text next to it.
 */
export function RouteRail({ from, to, className }: RouteRailProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex w-2.5 shrink-0 flex-col items-center py-1",
        className,
      )}
    >
      <ZoneDot zone={from} />
      <span
        className="my-0.5 w-[2px] flex-1 rounded-full"
        style={{
          backgroundImage: `linear-gradient(${zoneColor(from)}, ${zoneColor(to)})`,
          minHeight: "0.875rem",
        }}
      />
      <ZoneDot hollow zone={to} />
    </span>
  );
}

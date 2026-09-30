"use client";

import { useId } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { ZONE_COLORS } from "@/lib/constants/zone-colors";
import type { DhakaArea } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface Station {
  zone: DhakaArea;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  anchor?: "start" | "middle" | "end";
}

/* Schematic positions: north is up, but distances are simplified the way a
   transit diagram simplifies them. */
const STATIONS: Station[] = [
  { zone: "Uttara", x: 318, y: 44, labelX: 332, labelY: 49, anchor: "start" },
  { zone: "Mirpur", x: 104, y: 128, labelX: 104, labelY: 110 },
  { zone: "Bashundhara", x: 412, y: 128, labelX: 412, labelY: 110 },
  { zone: "Banani", x: 262, y: 186, labelX: 248, labelY: 191, anchor: "end" },
  {
    zone: "Gulshan 2",
    x: 412,
    y: 206,
    labelX: 426,
    labelY: 211,
    anchor: "start",
  },
  {
    zone: "Gulshan 1",
    x: 378,
    y: 240,
    labelX: 392,
    labelY: 256,
    anchor: "start",
  },
  {
    zone: "Mohakhali",
    x: 262,
    y: 272,
    labelX: 248,
    labelY: 290,
    anchor: "end",
  },
  {
    zone: "Farmgate",
    x: 206,
    y: 328,
    labelX: 220,
    labelY: 333,
    anchor: "start",
  },
  { zone: "Dhanmondi", x: 104, y: 358, labelX: 104, labelY: 384 },
];

/* Background network, each line tinted with the zone it serves. */
const NETWORK: { d: string; color: string }[] = [
  {
    d: "M318 44 V110 L262 166 V272 L206 328 L176 358 H104",
    color: ZONE_COLORS.Uttara,
  },
  { d: "M104 128 H200 L258 186 H262", color: ZONE_COLORS.Mirpur },
  { d: "M412 128 V206 L378 240", color: ZONE_COLORS["Gulshan 2"] },
  {
    d: "M262 186 H324 L378 240 L346 272 H262",
    color: ZONE_COLORS["Gulshan 1"],
  },
];

const INK = "#14231D";
const PAPER = "#F6F2EA";
const SKY = "#2B7FD8";

/* The featured pool: two riders share a Banani pickup; one is dropped at
   Gulshan 1 and the other rides on to Mohakhali. */
const POOL_ROUTE = "M262 186 H324 L378 240 L346 272 H262";
const POOL_ROUTE_LENGTH = 270;
const ROUTE_ZONES = new Set<DhakaArea>(["Banani", "Gulshan 1", "Mohakhali"]);

interface DhakaRouteMapProps {
  ariaLabel: string;
  className?: string;
}

export default function DhakaRouteMap({
  ariaLabel,
  className,
}: DhakaRouteMapProps) {
  const reduceMotion = usePrefersReducedMotion();
  const idBase = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const routeId = `pool-route-${idBase}`;
  const glowId = `pool-glow-${idBase}`;

  return (
    <svg
      aria-label={ariaLabel}
      className={cn("h-auto w-full", className)}
      role="img"
      viewBox="0 0 500 400"
    >
      <defs>
        <linearGradient id={`${routeId}-stroke`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={ZONE_COLORS.Banani} />
          <stop offset="0.55" stopColor={ZONE_COLORS["Gulshan 1"]} />
          <stop offset="1" stopColor={ZONE_COLORS.Mohakhali} />
        </linearGradient>
        <filter height="200%" id={glowId} width="200%" x="-50%" y="-50%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* Turag and Buriganga, and the Gulshan–Banani lake */}
      <path
        d="M34 0 C 58 120, 20 220, 52 300 S 40 380, 150 400"
        fill="none"
        stroke={SKY}
        strokeLinecap="round"
        strokeOpacity="0.16"
        strokeWidth="16"
      />
      <path
        d="M300 206 C 330 196, 350 214, 346 226 S 318 232, 304 222 Z"
        fill={SKY}
        fillOpacity="0.14"
      />

      {NETWORK.map((line) => (
        <path
          d={line.d}
          fill="none"
          key={line.d}
          stroke={line.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.32"
          strokeWidth="5"
        />
      ))}

      <path
        className="animate-draw"
        d={POOL_ROUTE}
        fill="none"
        filter={`url(#${glowId})`}
        stroke={`url(#${routeId}-stroke)`}
        strokeDasharray={POOL_ROUTE_LENGTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.55"
        strokeWidth="10"
        style={{ ["--path-length" as string]: POOL_ROUTE_LENGTH }}
      />
      <path
        className="animate-draw"
        d={POOL_ROUTE}
        fill="none"
        id={routeId}
        stroke={`url(#${routeId}-stroke)`}
        strokeDasharray={POOL_ROUTE_LENGTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="6"
        style={{ ["--path-length" as string]: POOL_ROUTE_LENGTH }}
      />

      {STATIONS.map((station, index) => {
        const onRoute = ROUTE_ZONES.has(station.zone);
        const color = ZONE_COLORS[station.zone];

        return (
          <g key={station.zone}>
            {onRoute ? (
              <circle
                className="animate-ping"
                cx={station.x}
                cy={station.y}
                fill={color}
                r="7"
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animationDelay: `${1.6 + index * 0.25}s`,
                }}
              />
            ) : null}
            <circle
              className="animate-pop"
              cx={station.x}
              cy={station.y}
              fill={onRoute ? INK : color}
              r={onRoute ? 8 : 5}
              stroke={onRoute ? color : INK}
              strokeWidth={onRoute ? 4 : 2.5}
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animationDelay: `${0.15 + index * 0.06}s`,
              }}
            />
            <text
              className="animate-fade"
              fill={PAPER}
              fillOpacity={onRoute ? 1 : 0.55}
              fontSize={onRoute ? 15 : 12.5}
              fontWeight={onRoute ? 700 : 500}
              style={{ animationDelay: `${0.4 + index * 0.06}s` }}
              textAnchor={station.anchor ?? "middle"}
              x={station.labelX}
              y={station.labelY}
            >
              {station.zone}
            </text>
          </g>
        );
      })}

      {/* The shared car. Each seat dot takes its rider's destination colour
          and empties at that rider's stop. */}
      <g className="animate-fade" style={{ animationDelay: "1.4s" }}>
        <g transform={reduceMotion ? "translate(262 186)" : undefined}>
          <rect fill={PAPER} height="16" rx="8" width="26" x="-13" y="-8" />
          <circle cx="-5" cy="0" fill={ZONE_COLORS["Gulshan 1"]} r="2.6">
            {reduceMotion ? null : (
              <animate
                attributeName="fill-opacity"
                dur="8s"
                keyTimes="0;0.56;0.6;1"
                repeatCount="indefinite"
                values="1;1;0.2;0.2"
              />
            )}
          </circle>
          <circle cx="1.5" cy="0" fill={ZONE_COLORS.Mohakhali} r="2.6">
            {reduceMotion ? null : (
              <animate
                attributeName="fill-opacity"
                dur="8s"
                keyTimes="0;0.94;0.97;1"
                repeatCount="indefinite"
                values="1;1;0.2;0.2"
              />
            )}
          </circle>
          <circle cx="8" cy="0" fill={INK} fillOpacity="0.2" r="2.6" />
          {reduceMotion ? null : (
            <animateMotion
              calcMode="linear"
              dur="8s"
              keyPoints="0;0;0.52;0.52;1;1"
              keyTimes="0;0.24;0.56;0.68;0.94;1"
              repeatCount="indefinite"
            >
              <mpath href={`#${routeId}`} />
            </animateMotion>
          )}
        </g>
      </g>
    </svg>
  );
}

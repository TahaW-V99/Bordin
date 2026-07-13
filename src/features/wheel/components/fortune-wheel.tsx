"use client";

import Image from "next/image";
import { formatPersianNumber } from "@/shared/lib/dates";

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = SIZE / 2 - 6;
const HUB_R = 42;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function segmentPath(index: number, segmentAngle: number) {
  const start = index * segmentAngle;
  const end = start + segmentAngle;
  const p1 = polar(CX, CY, R, end);
  const p2 = polar(CX, CY, R, start);
  const largeArc = segmentAngle > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${p1.x} ${p1.y} A ${R} ${R} 0 ${largeArc} 0 ${p2.x} ${p2.y} Z`;
}

function segmentLabelPosition(index: number, segmentAngle: number) {
  const angle = index * segmentAngle + segmentAngle / 2;
  return polar(CX, CY, R * 0.68, angle);
}

export function computeWheelRotation(segmentIndex: number, segmentCount: number, extraSpins = 6) {
  const segmentAngle = 360 / Math.max(segmentCount, 1);
  const segmentCenter = segmentIndex * segmentAngle + segmentAngle / 2;
  return extraSpins * 360 + (360 - segmentCenter);
}

type FortuneWheelProps = {
  segments: number[];
  wheelRotation: number;
  ballRotation: number;
  spinning: boolean;
};

export function FortuneWheel({
  segments,
  wheelRotation,
  ballRotation,
  spinning,
}: FortuneWheelProps) {
  const segmentAngle = 360 / Math.max(segments.length, 1);
  const spinTransition = spinning
    ? "transform 4.2s cubic-bezier(0.12, 0.75, 0.1, 1)"
    : "none";

  return (
    <div className="relative mx-auto aspect-square w-[min(88vw,300px)] max-w-[300px]">
      <div className="pointer-events-none absolute left-1/2 top-1 z-30 -translate-x-1/2">
        <div className="h-0 w-0 border-l-[11px] border-r-[11px] border-t-[20px] border-l-transparent border-r-transparent border-t-bordin-orange drop-shadow-[0_0_8px_rgba(255,161,0,0.6)]" />
      </div>

      <div
        className="absolute inset-0 rounded-full border-4 border-bordin-orange/80 shadow-glow-orange"
        style={{
          transform: `rotate(${wheelRotation}deg)`,
          transition: spinTransition,
        }}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
          {segments.map((amount, index) => {
            const label = segmentLabelPosition(index, segmentAngle);
            const textAngle = index * segmentAngle + segmentAngle / 2;
            return (
              <g key={`${amount}-${index}`}>
                <path
                  d={segmentPath(index, segmentAngle)}
                  fill={index % 2 === 0 ? "#1c1408" : "#111111"}
                  stroke="#ffa100"
                  strokeWidth="1.2"
                />
                <text
                  x={label.x}
                  y={label.y}
                  fill="#ffa100"
                  fontSize="13"
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${textAngle}, ${label.x}, ${label.y})`}
                >
                  {formatPersianNumber(amount)}
                </text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={HUB_R + 4} fill="#0a0a0a" stroke="#ffa100" strokeWidth="2" />
        </svg>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <div
          className="relative h-[28%] w-[28%]"
          style={{
            transform: `rotate(${ballRotation}deg)`,
            transition: spinTransition,
          }}
        >
          <Image
            src="/images/wheel/football.png"
            alt=""
            fill
            className="object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
            sizes="84px"
            priority
          />
        </div>
      </div>
    </div>
  );
}

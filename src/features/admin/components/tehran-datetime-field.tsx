"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format as formatJalali,
  getDay,
  getMonth,
  getYear,
  newDate,
  startOfMonth,
  subMonths,
} from "date-fns-jalali";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/cn";
import { formatTehranDateTime, TEHRAN_TZ, toPersianDigits } from "@/shared/lib/dates";
import { tehranLocalInputToDate } from "@/shared/lib/tehran-datetime";

const HOUR24_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

const selectClassName =
  "rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm text-white focus:border-bordin-orange/60 focus:outline-none";

const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const WEEKDAY_LABELS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

type TehranDateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (isoValue: string) => void;
  hint?: string;
  error?: string;
};

function jalaliPartsFromIso(iso: string) {
  const instant = new Date(iso);
  const y = getYear(instant);
  const m = getMonth(instant) + 1;
  const d = Number(formatJalali(instant, "d"));
  const hour = Number(formatInTimeZone(instant, TEHRAN_TZ, "H"));
  const minute = Number(formatInTimeZone(instant, TEHRAN_TZ, "m"));
  return { y, m, d, hour, minute };
}

function isoFromJalaliParts(y: number, m: number, d: number, hour: number, minute: number) {
  const instant = newDate(y, m - 1, d);
  const gregorianKey = formatInTimeZone(instant, TEHRAN_TZ, "yyyy-MM-dd");
  const localValue = `${gregorianKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return tehranLocalInputToDate(localValue).toISOString();
}

export function TehranDateTimeField({
  label,
  value,
  onChange,
  hint,
  error,
}: TehranDateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const initial = value ? jalaliPartsFromIso(value) : null;
  const [viewYear, setViewYear] = useState(initial?.y ?? getYear(new Date()));
  const [viewMonth, setViewMonth] = useState(initial?.m ?? getMonth(new Date()) + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(initial?.d ?? null);
  const [hour24, setHour24] = useState(initial?.hour ?? 12);
  const [minute, setMinute] = useState(initial?.minute ?? 0);

  const syncDraftFromValue = (iso: string) => {
    const parts = jalaliPartsFromIso(iso);
    setViewYear(parts.y);
    setViewMonth(parts.m);
    setSelectedDay(parts.d);
    setHour24(parts.hour);
    setMinute(parts.minute);
  };

  useEffect(() => {
    if (!value) return;
    syncDraftFromValue(value);
  }, [value]);

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const popoverWidth = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8));
    const estimatedHeight = 430;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    setPopoverStyle({
      position: "fixed",
      left,
      width: popoverWidth,
      zIndex: 250,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 8 }
        : { top: rect.bottom + 8 }),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const monthAnchor = useMemo(() => newDate(viewYear, viewMonth - 1, 1), [viewYear, viewMonth]);
  const days = useMemo(() => {
    const start = startOfMonth(monthAnchor);
    const end = endOfMonth(monthAnchor);
    return eachDayOfInterval({ start, end });
  }, [monthAnchor]);

  const leadingBlanks = (getDay(monthAnchor) + 1) % 7;
  const displayText = value ? formatTehranDateTime(value) : "انتخاب تاریخ و ساعت";

  const applySelection = (day: number) => {
    setSelectedDay(day);
  };

  const saveSelection = () => {
    if (selectedDay == null) return;
    const safeHour = Math.min(23, Math.max(0, hour24));
    const safeMinute = Math.min(59, Math.max(0, minute));
    onChange(isoFromJalaliParts(viewYear, viewMonth, selectedDay, safeHour, safeMinute));
    setOpen(false);
  };

  const openPicker = () => {
    if (value) syncDraftFromValue(value);
    setOpen(true);
    requestAnimationFrame(updatePopoverPosition);
  };

  const goPrevMonth = () => {
    const prev = subMonths(monthAnchor, 1);
    setViewYear(getYear(prev));
    setViewMonth(getMonth(prev) + 1);
  };

  const goNextMonth = () => {
    const next = addMonths(monthAnchor, 1);
    setViewYear(getYear(next));
    setViewMonth(getMonth(next) + 1);
  };

  const popover = open ? (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="max-h-[min(430px,80vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#111] p-3 shadow-2xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={goPrevMonth} className="rounded-lg p-1.5 hover:bg-white/10">
          <ChevronRight className="h-5 w-5" />
        </button>
        <p className="text-sm font-bold">
          {JALALI_MONTHS[viewMonth - 1]} {toPersianDigits(viewYear)}
        </p>
        <button type="button" onClick={goNextMonth} className="rounded-lg p-1.5 hover:bg-white/10">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-white/45">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((dayDate) => {
          const dayNum = Number(formatJalali(dayDate, "d"));
          const active = selectedDay === dayNum && getMonth(dayDate) + 1 === viewMonth;
          return (
            <button
              key={dayDate.toISOString()}
              type="button"
              onClick={() => applySelection(dayNum)}
              className={cn(
                "rounded-lg py-2 text-sm transition",
                active
                  ? "bg-bordin-orange font-bold text-black"
                  : "hover:bg-white/10 text-white/85",
              )}
            >
              {toPersianDigits(dayNum)}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-3 border-t border-white/8 pt-3">
        <p className="text-xs text-white/50">ساعت (وقت تهران)</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="دقیقه"
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
            className={cn(selectClassName, "w-16")}
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {toPersianDigits(String(m).padStart(2, "0"))}
              </option>
            ))}
          </select>
          <span className="text-white/40">:</span>
          <select
            aria-label="ساعت"
            value={hour24}
            onChange={(e) => setHour24(Number(e.target.value))}
            className={cn(selectClassName, "w-16")}
          >
            {HOUR24_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {toPersianDigits(String(h).padStart(2, "0"))}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sticky bottom-0 mt-3 border-t border-white/8 bg-[#111] pt-3">
        <Button
          type="button"
          size="md"
          fullWidth
          disabled={selectedDay == null}
          onClick={saveSelection}
        >
          تایید تاریخ
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <p className="text-sm font-medium text-white/80">{label}</p>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right transition",
          "hover:border-bordin-orange/40 focus:border-bordin-orange/60 focus:outline-none focus:ring-2 focus:ring-bordin-orange/20",
          error && "border-red-500/50",
          !value && "text-white/35",
        )}
      >
        <span className={value ? "text-white" : undefined}>{displayText}</span>
        <Calendar className="h-5 w-5 shrink-0 text-bordin-orange" />
      </button>
      {hint ? <p className="text-xs text-white/40">{hint}</p> : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {typeof document !== "undefined" && popover ? createPortal(popover, document.body) : null}
    </div>
  );
}

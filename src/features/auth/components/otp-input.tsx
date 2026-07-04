"use client";

import {
  useRef,
  useEffect,
  KeyboardEvent,
  ClipboardEvent,
  ChangeEvent,
} from "react";
import { cn } from "@/shared/lib/cn";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  error,
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const submittedRef = useRef<string | null>(null);
  const digits = value.padEnd(6, " ").split("").slice(0, 6);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (value.length < 6) {
      submittedRef.current = null;
      return;
    }
    if (/^\d{6}$/.test(value) && submittedRef.current !== value) {
      submittedRef.current = value;
      onComplete?.(value);
    }
  }, [value, onComplete]);

  const updateAt = (index: number, char: string) => {
    const next = value.split("");
    next[index] = char;
    onChange(next.join("").replace(/\s/g, "").slice(0, 6));
  };

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      updateAt(index, "");
      return;
    }
    const chars = raw.split("");
    let cursor = index;
    const merged = value.split("");
    for (const c of chars) {
      if (cursor > 5) break;
      merged[cursor] = c;
      cursor += 1;
    }
    onChange(merged.join("").slice(0, 6));
    inputsRef.current[Math.min(cursor, 5)]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index]?.trim()) {
      const prev = index - 1;
      if (prev >= 0) {
        updateAt(prev, "");
        inputsRef.current[prev]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted);
      inputsRef.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2" dir="ltr">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={6}
          disabled={disabled}
          value={digit.trim()}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          aria-label={`رقم ${index + 1} کد تأیید`}
          className={cn(
            "h-12 w-10 rounded-xl border bg-white/5 text-center text-lg font-semibold text-white outline-none transition focus:border-bordin-orange/60 focus:ring-2 focus:ring-bordin-orange/20 sm:h-14 sm:w-12",
            error ? "border-red-500/50" : "border-white/10",
            disabled && "opacity-50",
          )}
        />
      ))}
    </div>
  );
}

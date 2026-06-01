"use client";

import type React from "react";
import { usePrivacyMode } from "@/lib/privacy-context";
import { cn } from "@/lib/utils";

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatEuroCompact(n: number) {
  if (Math.abs(n) >= 1000)
    return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k €`;
  return formatEuro(n);
}

interface AmountProps {
  value: number;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Amount({ value, compact, className, style }: AmountProps) {
  const { isHidden } = usePrivacyMode();
  const text = compact ? formatEuroCompact(value) : formatEuro(value);
  return (
    <span className={cn(isHidden && "blur-sm select-none", className)} style={style}>
      {text}
    </span>
  );
}

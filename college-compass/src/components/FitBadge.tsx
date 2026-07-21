"use client";
import React from "react";
import { fitTone } from "@/lib/fit";
import type { Confidence, FitCategory } from "@/lib/types";
import { Pill } from "./ui";

export function FitBadge({ category }: { category: FitCategory }) {
  return <Pill tone={fitTone(category)}>{category}</Pill>;
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const tone = confidence === "High" ? "navy" : confidence === "Moderate" ? "slate" : "amber";
  return <Pill tone={tone}>Data confidence: {confidence}</Pill>;
}

/**
 * Signature element: a compass dial. The needle sweeps from "High Reach"
 * (west) to "Likely" (east); the personalized Value & Fit score sits below it.
 */
export function CompassDial({
  category,
  score,
  size = 120,
}: {
  category: FitCategory;
  score?: number;
  size?: number;
}) {
  const angleByCategory: Record<FitCategory, number> = {
    "High Reach": -80,
    Reach: -40,
    Possible: 0,
    Target: 40,
    Likely: 80,
  };
  const angle = angleByCategory[category];
  const color =
    fitTone(category) === "green" ? "#15803D" : fitTone(category) === "amber" ? "#B45309" : "#B91C1C";
  return (
    <figure className="flex flex-col items-center" aria-label={`Admissions fit: ${category}`}>
      <svg width={size} height={size * 0.68} viewBox="0 0 120 82" role="img" aria-hidden>
        <path d="M 12 70 A 48 48 0 0 1 108 70" fill="none" stroke="#E2E8F0" strokeWidth="9" strokeLinecap="round" />
        <path d="M 12 70 A 48 48 0 0 1 43 27" fill="none" stroke="#FCA5A5" strokeWidth="9" strokeLinecap="round" />
        <path d="M 43 27 A 48 48 0 0 1 77 27" fill="none" stroke="#FCD34D" strokeWidth="9" strokeLinecap="round" />
        <path d="M 77 27 A 48 48 0 0 1 108 70" fill="none" stroke="#86EFAC" strokeWidth="9" strokeLinecap="round" />
        <g transform={`rotate(${angle} 60 70)`}>
          <polygon points="60,26 64,66 60,72 56,66" fill={color} />
        </g>
        <circle cx="60" cy="70" r="6" fill="#17365D" />
        <circle cx="60" cy="70" r="2.5" fill="white" />
      </svg>
      <figcaption className="mt-1 text-center">
        <span className="block text-sm font-bold" style={{ color }}>
          {category}
        </span>
        {score !== undefined && (
          <span className="block text-[11px] text-slate-500">Value &amp; Fit score {score}/100</span>
        )}
      </figcaption>
    </figure>
  );
}

"use client";
import React from "react";
import type { ScoreWeights } from "@/lib/types";
import { normalizeWeights } from "@/lib/score";

const LABELS: Record<keyof ScoreWeights, string> = {
  fit: "Personal admissions fit",
  affordability: "Affordability",
  academics: "Academic & major match",
  outcomes: "Outcomes",
  location: "Location & campus match",
  other: "Other preferences",
};

export function WeightSliders({
  weights,
  onChange,
}: {
  weights: ScoreWeights;
  onChange: (w: ScoreWeights) => void;
}) {
  const normalized = normalizeWeights(weights);
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Adjust how your personalized <strong>College Value &amp; Fit Score</strong> is weighted. This
        is a personal score, not a national ranking. Weights are normalized to 100%.
      </p>
      {(Object.keys(LABELS) as (keyof ScoreWeights)[]).map((k) => (
        <div key={k}>
          <div className="flex items-center justify-between text-xs">
            <label htmlFor={`w-${k}`} className="font-medium text-slate-700">{LABELS[k]}</label>
            <span className="tabular-nums text-slate-500">{Math.round(normalized[k])}%</span>
          </div>
          <input
            id={`w-${k}`}
            type="range"
            min={0}
            max={50}
            value={weights[k]}
            onChange={(e) => onChange({ ...weights, [k]: Number(e.target.value) })}
            className="w-full accent-brand"
          />
        </div>
      ))}
    </div>
  );
}

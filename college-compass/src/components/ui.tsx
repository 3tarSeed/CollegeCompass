"use client";
import React from "react";
import { AlertTriangle, Compass, Inbox, Loader2 } from "lucide-react";

export function SampleBadge({ label = "Sample data" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-300 px-2 py-0.5 text-[11px] font-semibold text-fitAmber">
      {label}
    </span>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "navy" | "slate";
  children: React.ReactNode;
}) {
  const cls = {
    green: "bg-green-50 text-fitGreen border-green-200",
    amber: "bg-amber-50 text-fitAmber border-amber-200",
    red: "bg-red-50 text-fitRed border-red-200",
    navy: "bg-blue-50 text-navy border-blue-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-slate-500" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 p-10 text-center">
      <Inbox className="h-8 w-8 text-slate-300" aria-hidden />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-slate-500">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, body, retry }: { title: string; body: string; retry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-2 border-red-200 p-8 text-center" role="alert">
      <AlertTriangle className="h-7 w-7 text-fitRed" aria-hidden />
      <h3 className="text-base font-semibold text-fitRed">{title}</h3>
      <p className="max-w-md text-sm text-slate-600">{body}</p>
      {retry && (
        <button onClick={retry} className="btn-ghost mt-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-lg bg-navy p-1.5 text-white">
      <Compass size={size} aria-hidden />
    </span>
  );
}

"use client";
import React from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import type { Provenance } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { SampleBadge } from "./ui";

/** Data year, source, last-verified, and a "verify on college website" action. */
export function DataProvenance({
  provenance,
  verifyUrl,
  warning,
}: {
  provenance: Provenance;
  verifyUrl?: string | null;
  warning?: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
      {provenance.isSample && <SampleBadge />}
      <span>Data year: {provenance.dataYear}</span>
      <span aria-hidden>·</span>
      <a
        href={provenance.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-brand hover:underline"
      >
        {provenance.sourceName} <ExternalLink size={11} aria-hidden />
      </a>
      <span aria-hidden>·</span>
      <span>Last verified {fmtDate(provenance.lastVerified)}</span>
      {verifyUrl && (
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-teal/40 px-2 py-0.5 font-semibold text-teal hover:bg-teal/5"
        >
          <ShieldCheck size={12} aria-hidden /> Verify on college website
        </a>
      )}
      {warning && (
        <p className="w-full text-fitAmber">⚠ {warning}</p>
      )}
    </div>
  );
}

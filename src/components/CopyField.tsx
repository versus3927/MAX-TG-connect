"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyField({
  label,
  value,
  mono = true,
}: {
  label?: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      onClick={copy}
      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.06]"
    >
      <span className="min-w-0">
        {label ? (
          <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            {label}
          </span>
        ) : null}
        <span
          className={`block truncate text-[13px] text-zinc-200 ${mono ? "font-mono" : ""}`}
        >
          {value}
        </span>
      </span>
      <span className="shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-200">
        {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
      </span>
    </button>
  );
}

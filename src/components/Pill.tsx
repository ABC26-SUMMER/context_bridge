import type { ReactNode } from "react";

type PillProps = {
  children: ReactNode;
  tone?: "neutral" | "normal" | "sensitive";
};

export function Pill({ children, tone = "neutral" }: PillProps) {
  const toneClass =
    tone === "sensitive"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "normal"
        ? "border-green-200 bg-green-50 text-green-800"
        : "border-line bg-zinc-50 text-muted";

  return (
    <span className={`inline-flex min-h-7 items-center border px-2.5 text-xs font-bold ${toneClass}`}>
      {children}
    </span>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { box: string; icon: string }> = {
  info: { box: "bg-primary-soft border-primary/30", icon: "text-accent" },
  success: { box: "bg-success-soft border-success/30", icon: "text-success" },
  warning: { box: "bg-warning-soft border-warning/30", icon: "text-warning" },
  danger: { box: "bg-danger-soft border-danger/30", icon: "text-danger" },
};

const ICON_PATHS: Record<Tone, string> = {
  info: "M12 8h.01M11 12h1v4h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  success: "m8 12 3 3 5-6M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  warning: "M12 9v4m0 3h.01M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z",
  danger: "M12 8v5m0 3h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-md border p-4 text-fg", TONES[tone].box, className)}
    >
      <svg
        className={cn("mt-0.5 size-5 shrink-0", TONES[tone].icon)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ICON_PATHS[tone]} />
      </svg>
      <div className="text-sm leading-relaxed">
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        {children && <div className="text-fg-muted">{children}</div>}
      </div>
    </div>
  );
}

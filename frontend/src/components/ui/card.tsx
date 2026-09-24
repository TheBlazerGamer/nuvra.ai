import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const PADDING = { none: "", sm: "p-4", md: "p-6", lg: "p-8" } as const;

export function Card({
  padding = "md",
  className,
  ...props
}: ComponentProps<"div"> & { padding?: keyof typeof PADDING }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface text-fg shadow-card",
        PADDING[padding],
        className,
      )}
      {...props}
    />
  );
}

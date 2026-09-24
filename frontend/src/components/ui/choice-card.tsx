import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ChoiceCardProps extends Omit<ComponentProps<"input">, "type" | "children" | "title"> {
  title: string;
  description?: string;
  footer?: ReactNode;
}

export function ChoiceCard({ title, description, footer, className, ...props }: ChoiceCardProps) {
  return (
    <label className={cn("group block cursor-pointer", className)}>
      <input type="radio" className="peer sr-only" {...props} />
      <div
        className={cn(
          "rounded-lg border border-line bg-surface p-4 text-fg transition-colors duration-150",
          "hover:border-line-strong peer-checked:border-primary peer-checked:bg-primary-soft",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-55",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="font-medium">{title}</span>
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-line-strong",
              "group-has-[:checked]:border-primary group-has-[:checked]:bg-primary",
            )}
          >
            <span className="size-2 rounded-full bg-primary-fg opacity-0 group-has-[:checked]:opacity-100" />
          </span>
        </div>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
        {footer && <div className="mt-3">{footer}</div>}
      </div>
    </label>
  );
}

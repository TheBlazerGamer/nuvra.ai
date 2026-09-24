import { cn } from "@/lib/cn";

export interface Step {
  label: string;
  description?: string;
}

export function Stepper({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <ol className="flex flex-col gap-5">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li
            key={step.label}
            aria-current={active ? "step" : undefined}
            className="flex items-start gap-3"
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
                done && "bg-primary text-primary-fg",
                active && "border-2 border-primary bg-primary-soft text-accent",
                !done && !active && "border border-line-strong text-fg-subtle",
              )}
            >
              {done ? (
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 5 5 9-10" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <div className="pt-1">
              <p className={cn("text-base font-medium", !done && !active && "text-fg-muted")}>
                {step.label}
                {done && <span className="sr-only"> (concluído)</span>}
              </p>
              {step.description && <p className="text-sm text-fg-subtle">{step.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

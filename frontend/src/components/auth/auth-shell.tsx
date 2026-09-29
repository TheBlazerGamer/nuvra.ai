import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/ui/card";

export function AuthShell({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 bg-nuvra-navy px-4 py-12">
      <Logo variant="lockup" tone="paper" height={28} priority />

      <Card className="w-full max-w-sm">
        <h1 className="text-h2">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-fg-muted">{descricao}</p>}

        <div className="mt-6 flex flex-col gap-4">{children}</div>

        {rodape && <p className="mt-6 text-sm text-fg-muted">{rodape}</p>}
      </Card>
    </main>
  );
}

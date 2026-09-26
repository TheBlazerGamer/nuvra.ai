import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Alert } from "@/components/ui/alert";
import { ATUALIZADO_EM, DADOS_PENDENTES } from "@/lib/empresa";

const LINKS = [
  { href: "/privacidade", texto: "Política de privacidade" },
  { href: "/termos", texto: "Termos de uso" },
  { href: "/exclusao-de-dados", texto: "Exclusão de dados" },
];

export function DocumentoLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex-1 bg-surface text-fg">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" aria-label="Nuvra.AI, página inicial">
            <Logo variant="lockup" tone="blue" height={28} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-h1">{titulo}</h1>
        <p className="mt-1 text-sm text-fg-subtle">Última atualização: {ATUALIZADO_EM}</p>

        {DADOS_PENDENTES && (
          <Alert tone="warning" title="Rascunho: dados da empresa pendentes" className="mt-6">
            Os campos entre colchetes ainda precisam ser preenchidos e o texto revisado por um advogado antes da
            publicação.
          </Alert>
        )}

        <article className="mt-8 flex flex-col gap-8 leading-relaxed">{children}</article>
      </main>

      <footer className="border-t border-line">
        <nav
          aria-label="Documentos legais"
          className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm"
        >
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-accent hover:underline">
              {l.texto}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h2">{titulo}</h2>
      {children}
    </section>
  );
}

export function Lista({ itens }: { itens: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-6 text-fg-muted marker:text-fg-subtle">
      {itens.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-fg-muted">{children}</p>;
}

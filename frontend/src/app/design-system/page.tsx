import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceCard } from "@/components/ui/choice-card";
import { Stepper } from "@/components/ui/stepper";
import { TextField } from "@/components/ui/text-field";

export const metadata: Metadata = {
  title: "Design System · Nuvra.AI",
  robots: { index: false, follow: false },
};

const CORES_MARCA = [
  { nome: "Azul Nuvra", hex: "#1747E9", classe: "bg-nuvra-blue text-white" },
  { nome: "Azul profundo", hex: "#01219C", classe: "bg-nuvra-blue-medium text-white" },
  { nome: "Navy", hex: "#010C28", classe: "bg-nuvra-navy text-white" },
  { nome: "Papel", hex: "#E5E5E5", classe: "bg-nuvra-paper text-nuvra-navy border border-line-strong" },
];

const CORES_SEMANTICAS = [
  { token: "page", classe: "bg-page" },
  { token: "surface", classe: "bg-surface" },
  { token: "surface-muted", classe: "bg-surface-muted" },
  { token: "primary", classe: "bg-primary" },
  { token: "primary-soft", classe: "bg-primary-soft" },
  { token: "success", classe: "bg-success" },
  { token: "warning", classe: "bg-warning" },
  { token: "danger", classe: "bg-danger" },
];

const ETAPAS = [
  { label: "Criar sua conta", description: "E-mail e senha" },
  { label: "Conectar o Telegram", description: "Um toque para vincular a conversa" },
  { label: "Vincular a conta de anúncio", description: "A Nuvra faz isso com você" },
  { label: "Pedir a primeira campanha" },
];

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h2">{titulo}</h2>
      {children}
    </section>
  );
}

function Amostras({ grupo }: { grupo: string }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button>Publicar campanha</Button>
        <Button variant="secondary">Voltar</Button>
        <Button variant="ghost">Cancelar</Button>
        <Button variant="danger">Pausar tudo</Button>
        <Button loading>Enviando</Button>
        <Button disabled>Indisponível</Button>
        <Button size="sm">Pequeno</Button>
        <Button size="lg">Grande</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="E-mail" type="email" placeholder="voce@empresa.com" hint="Usamos só para o seu acesso." />
        <TextField label="Senha" type="password" defaultValue="123" error="A senha precisa ter ao menos 12 caracteres." />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ChoiceCard name={`demo-${grupo}`} title="Tráfego" description="Leva pessoas até o seu site ou página de vendas." defaultChecked />
        <ChoiceCard name={`demo-${grupo}`} title="Leads" description="Capta nome, telefone e e-mail dentro do próprio anúncio." />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge>Rascunho</Badge>
        <Badge tone="primary">Em análise</Badge>
        <Badge tone="success">Publicada</Badge>
        <Badge tone="warning">Aguardando saldo</Badge>
        <Badge tone="danger">Erro</Badge>
      </div>

      <div className="grid gap-3">
        <Alert tone="info" title="Vendas funciona melhor com rastreamento">
          Recomendamos Pixel + API de Conversões. Sem isso, o resultado tende a ser menos preciso.
        </Alert>
        <Alert tone="success" title="Telegram conectado" />
        <Alert tone="warning" title="Saldo baixo">Adicione saldo na carteira para a IA continuar publicando.</Alert>
        <Alert tone="danger" title="Não foi possível publicar">Tente de novo em alguns minutos.</Alert>
      </div>

      <Card>
        <h3>Onboarding</h3>
        <p className="mb-5 mt-1 text-sm text-fg-muted">Cada etapa explica o que vai acontecer.</p>
        <Stepper steps={ETAPAS} current={1} />
      </Card>
    </div>
  );
}

export default function PaginaDesignSystem() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-12">
      <header className="flex flex-col gap-3">
        <Logo variant="lockup" tone="blue" height={40} priority />
        <h1 className="text-display font-display font-extrabold">Design System</h1>
        <p className="max-w-xl text-fg-muted">
          Tokens e componentes base do Nuvra.AI. Toda tela nova usa somente o que está aqui.
        </p>
      </header>

      <Secao titulo="Cores da marca">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {CORES_MARCA.map((c) => (
            <div key={c.hex} className={`rounded-lg p-4 ${c.classe}`}>
              <p className="font-display font-bold">{c.nome}</p>
              <p className="text-sm opacity-80">{c.hex}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {CORES_SEMANTICAS.map((c) => (
            <div key={c.token} className="flex items-center gap-3 rounded-md border border-line bg-surface p-2 text-sm">
              <span className={`size-8 rounded-sm border border-line ${c.classe}`} />
              <code>{c.token}</code>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Tipografia">
        <Card className="flex flex-col gap-3">
          <p className="text-display font-display font-extrabold">Display 48</p>
          <h1>Título H1 · 32</h1>
          <h2>Título H2 · 24</h2>
          <h3>Título H3 · 18</h3>
          <p className="text-base">Corpo 16 — Inter. A IA analisa o criativo e publica a campanha na sua conta de anúncio.</p>
          <p className="text-sm text-fg-muted">Texto pequeno 14 — apoio e descrições.</p>
          <p className="text-xs text-fg-subtle">Legenda 12 — metadados.</p>
        </Card>
      </Secao>

      <Secao titulo="Componentes · tema claro">
        <Amostras grupo="claro" />
      </Secao>

      <div data-theme="dark" className="rounded-xl bg-page p-6 text-fg md:p-8">
        <div className="flex flex-col gap-12">
          <Secao titulo="Componentes · tema escuro">
            <Amostras grupo="escuro" />
          </Secao>
        </div>
      </div>

      <Secao titulo="Logos">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center justify-center rounded-lg bg-white p-8">
            <Logo variant="lockup" tone="blue" height={40} />
          </div>
          <div data-theme="dark" className="flex items-center justify-center rounded-lg bg-page p-8">
            <Logo variant="lockup" tone="paper" height={40} />
          </div>
          <div className="flex items-center justify-center gap-8 rounded-lg bg-white p-8">
            <Logo variant="wordmark" tone="navy" height={24} />
            <Logo variant="symbol" tone="blue" height={40} />
          </div>
          <div data-theme="dark" className="flex items-center justify-center gap-8 rounded-lg bg-page p-8">
            <Logo variant="wordmark" tone="paper" height={24} />
            <Logo variant="symbol" tone="paper" height={40} />
          </div>
        </div>
      </Secao>
    </main>
  );
}

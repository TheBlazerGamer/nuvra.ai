import Link from "next/link";

export default function PaginaInicial() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center bg-nuvra-navy text-center px-4">
      <h1 className="text-3xl font-semibold text-white">Nuvra.AI</h1>
      <p className="text-white/60 mt-2 max-w-sm">
        Gestão autônoma de tráfego pago no Meta Ads, operada por Inteligência Artificial.
      </p>
      <div className="flex gap-3 mt-8">
        <Link
          href="/login"
          className="rounded-lg border border-white/20 px-5 py-2.5 text-white hover:bg-white/10"
        >
          Entrar
        </Link>
        <Link
          href="/cadastro"
          className="rounded-lg bg-nuvra-blue px-5 py-2.5 text-white hover:bg-nuvra-blue-medium"
        >
          Criar conta
        </Link>
      </div>
    </main>
  );
}

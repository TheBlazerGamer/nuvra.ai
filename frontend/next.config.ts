import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera .next/standalone: só o necessário para rodar em produção, sem precisar
  // copiar node_modules inteiro para dentro da imagem Docker.
  output: "standalone",
};

export default nextConfig;

# legacy/

Código da versão 1 (briefing v1). **Não é compilado nem executado** — fica só como referência enquanto cada módulo do briefing v2 é reescrito, um de cada vez, já com o isolamento por cliente (RLS) e a autenticação nova.

Aproveitar daqui, ao chegar a hora de cada módulo: `meta-ads/` (chamadas à Graph API), `ia/` (análise de criativo), `campanhas/` (fluxo de publicação), `relatorios/` (agregação semanal), `storage/` (DigitalOcean Spaces).

Não reaproveitar: `auth/`, `admin/`, `funcionarios/` (tokens JWT em `localStorage`, sem isolamento por cliente).

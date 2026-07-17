# Alice Farma

Plataforma web para farmácias cotarem medicamentos com múltiplos fornecedores, comparar preços em tempo real e decidir a compra mais econômica.

## O que é

Alice Farma (nome interno do projeto: `falta-farmacia`) é um SaaS multi-tenant para farmácias organizarem o processo de cotação de compras. A farmácia monta uma lista de medicamentos — digitando manualmente ou fazendo upload de um PDF, imagem, TXT ou CSV que é interpretado por IA — e a plataforma gera links exclusivos para que cada fornecedor cadastrado envie seus preços e prazos de validade sem precisar de login. Depois, a farmácia compara as ofertas lado a lado e acompanha economia, itens críticos e histórico de cotações em um dashboard com gráficos.

O projeto está em desenvolvimento ativo (SaaS real, com deploy em produção via Vercel), não é um protótipo estático: tem autenticação, banco multi-tenant com Row Level Security no Supabase, Edge Function própria para IA e um portal externo para fornecedores.

## Principais funcionalidades

- **Upload inteligente de cotação**: extração automática de `produto | quantidade` a partir de PDF, imagem, TXT ou CSV usando a OpenAI Responses API (via Edge Function `parse-medication-list`, com rate limiting e validação de tamanho/tipo de arquivo).
- **Portal do fornecedor**: link único por token (sem senha) onde o fornecedor informa preço e validade de cada item da cotação.
- **Comparação de cotações**: visualização lado a lado das ofertas recebidas para escolher o melhor fornecedor por item.
- **Dashboard**: gráficos de economia estimada, contagem de fornecedores, itens críticos por validade e histórico de cotações (Recharts).
- **Gestão de fornecedores**: cadastro, edição e ativação/desativação de fornecedores por farmácia.
- **Multi-tenant com Supabase**: políticas de Row Level Security por `farmacia_id`, funções RPC dedicadas para o fluxo do fornecedor (`listar_itens_fornecedor`, validação de token, salvamento de preços).
- **PWA**: manifest e service worker para instalação como aplicativo.

## Stack

- **Frontend**: React 19 + Vite, Tailwind CSS 4
- **Gráficos**: Recharts
- **Backend/dados**: Supabase (Postgres, Auth, RLS, Edge Functions em Deno)
- **IA**: OpenAI Responses API (parsing de listas de medicamentos)
- **Outros**: date-fns, lucide-react (ícones), xlsx (import/export de planilhas)
- **Deploy**: Vercel (frontend) + Supabase (backend/functions)

## Estrutura

```
src/
  components/     # Dashboard, QuoteInput, ComparisonView, SupplierPortal, SupplierManager, Login, Settings...
  lib/             # cliente Supabase, contexto de autenticação, parsers de cotação
supabase/
  functions/       # Edge Function parse-medication-list (Deno) + utilitários CORS
  migrations/      # políticas de RLS, RPCs do portal do fornecedor
```

## Rodando localmente

```bash
npm install
npm run dev
```

Crie um arquivo `.env` na raiz com base em `.env.example`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_WEBHOOK_PEDIDO_URL=...
```

A chave da OpenAI **não** vai para o frontend — ela é configurada como secret da Edge Function no Supabase:

```bash
supabase secrets set OPENAI_API_KEY=sk-... OPENAI_PARSER_MODEL=gpt-5.4-mini
```

Para desenvolver a Edge Function localmente:

```bash
supabase functions serve parse-medication-list --env-file supabase/functions/.env.local
```

Para deploy da função:

```bash
supabase functions deploy parse-medication-list
```

Outros scripts disponíveis: `npm run build` (build de produção), `npm run preview` (preview do build) e `npm run lint` (ESLint).

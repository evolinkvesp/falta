# Falta Farma

## Upload com IA

A tela de `Nova Cotacao` aceita upload de PDF, imagem, TXT e CSV para extrair `produto | quantidade` com OpenAI.

Fluxo:

1. O frontend envia o arquivo para a Edge Function `parse-medication-list`.
2. A Edge Function chama a OpenAI Responses API com `OPENAI_API_KEY` em segredo de servidor.
3. A funcao devolve a lista estruturada para revisao antes do disparo da cotacao.

## Configuracao

Variaveis do frontend em `.env`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_WEBHOOK_PEDIDO_URL=...
```

A chave da OpenAI nao deve ir para o Vite. Configure nas secrets do Supabase:

```bash
supabase secrets set OPENAI_API_KEY=sk-... OPENAI_PARSER_MODEL=gpt-5.4-mini
```

Para desenvolver a funcao localmente:

```bash
supabase functions serve parse-medication-list --env-file supabase/functions/.env.local
```

Para deploy:

```bash
supabase functions deploy parse-medication-list
```

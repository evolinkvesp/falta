import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const SUPPORTED_TEXT_TYPES = new Set(['text/plain', 'text/csv'])
const SUPPORTED_BINARY_TYPES = new Set(['application/pdf'])
const RATE_LIMIT_MAX_REQUESTS = Number(Deno.env.get('PARSER_RATE_LIMIT_MAX') ?? 10)
const RATE_LIMIT_WINDOW_MS = Number(Deno.env.get('PARSER_RATE_LIMIT_WINDOW_MS') ?? 60_000)
const rateLimiter = new Map<string, number[]>()

type ParsedItem = {
  query: string
  quantity: number
}

type RequestContext = {
  requestId: string
  userId?: string
  ip?: string
}

function getRequestId(req: Request) {
  return req.headers.get('x-request-id') || crypto.randomUUID()
}

function getClientIp(req: Request) {
  const xForwardedFor = req.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }
  return req.headers.get('x-real-ip') || undefined
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function logEvent(level: 'info' | 'warn' | 'error', event: string, context: RequestContext, data: Record<string, unknown> = {}) {
  const payload = {
    level,
    event,
    request_id: context.requestId,
    user_id: context.userId,
    ip: context.ip,
    ts: new Date().toISOString(),
    ...data,
  }
  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

function errorResponse(status: number, code: string, message: string, context: RequestContext, details: Record<string, unknown> = {}) {
  logEvent(status >= 500 ? 'error' : 'warn', 'request_error', context, { status, code, message, ...details })
  return jsonResponse({
    error: message,
    code,
    request_id: context.requestId,
  }, status)
}

function buildPrompt() {
  return [
    'Extraia uma lista de compra de farmacia a partir do arquivo enviado.',
    'Retorne apenas medicamentos ou itens farmaceuticos claramente identificados.',
    'Para cada item, devolva o nome do remedio/produto em query e a quantidade inteira em quantity.',
    'Se a quantidade nao estiver explicita, use 1.',
    'Ignore cabecalhos, dados do paciente, logos, medico, CRM, CPF, telefones e instrucoes que nao sejam itens.',
    'Se houver apresentacao relevante visivel (mg, ml, caixa, frasco), mantenha na query.',
    'Nao invente itens.',
  ].join(' ')
}

function buildSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            query: { type: 'string' },
            quantity: { type: 'integer', minimum: 1 },
          },
          required: ['query', 'quantity'],
        },
      },
    },
    required: ['items'],
  }
}

function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text
  }

  const output = Array.isArray(payload.output) ? payload.output : []
  for (const item of output) {
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? ((item as { content?: unknown[] }).content as Array<Record<string, unknown>>)
      : []

    for (const block of content) {
      if (typeof block.text === 'string' && block.text.trim()) {
        return block.text
      }

      if (block.json && typeof block.json === 'object') {
        return JSON.stringify(block.json)
      }
    }
  }

  return null
}

function normalizeItems(items: ParsedItem[]) {
  return items
    .map((item) => ({
      query: String(item.query || '').trim(),
      quantity: Number.isFinite(item.quantity) && item.quantity > 0
        ? Math.round(item.quantity)
        : 1,
    }))
    .filter((item) => item.query.length > 2)
}

function isRateLimited(key: string, nowMs: number) {
  const entries = rateLimiter.get(key) ?? []
  const alive = entries.filter((stamp) => nowMs - stamp < RATE_LIMIT_WINDOW_MS)

  if (alive.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimiter.set(key, alive)
    return true
  }

  alive.push(nowMs)
  rateLimiter.set(key, alive)
  return false
}

Deno.serve(async (req) => {
  const context: RequestContext = {
    requestId: getRequestId(req),
    ip: getClientIp(req),
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Metodo nao suportado.', context)
  }

  const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openAiApiKey) {
    return errorResponse(500, 'openai_key_missing', 'OPENAI_API_KEY nao configurada nas secrets do Supabase.', context)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return errorResponse(401, 'unauthorized', 'Nao autenticado.', context)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    },
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse(401, 'invalid_session', 'Sessao invalida.', context)
  }
  context.userId = user.id

  const rateLimitKey = `${user.id}:${context.ip || 'no-ip'}`
  if (isRateLimited(rateLimitKey, Date.now())) {
    return errorResponse(429, 'rate_limited', 'Muitas requisicoes. Tente novamente em instantes.', context, {
      max_requests: RATE_LIMIT_MAX_REQUESTS,
      window_ms: RATE_LIMIT_WINDOW_MS,
    })
  }

  const formData = await req.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return errorResponse(400, 'file_required', 'Arquivo obrigatorio.', context)
  }

  if (file.size > MAX_FILE_SIZE) {
    return errorResponse(400, 'file_too_large', 'Arquivo muito grande. Limite de 10MB.', context, {
      file_size: file.size,
    })
  }

  const isImage = file.type.startsWith('image/')
  const isText = SUPPORTED_TEXT_TYPES.has(file.type)
  const isPdf = SUPPORTED_BINARY_TYPES.has(file.type)

  if (!isImage && !isText && !isPdf) {
    return errorResponse(400, 'unsupported_file_type', 'Formato nao suportado. Use PDF, imagem, TXT ou CSV.', context, {
      file_type: file.type,
    })
  }

  logEvent('info', 'parse_started', context, {
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    rate_limit_max: RATE_LIMIT_MAX_REQUESTS,
    rate_limit_window_ms: RATE_LIMIT_WINDOW_MS,
  })

  const fileBytes = new Uint8Array(await file.arrayBuffer())
  const base64Data = toBase64(fileBytes)

  const userContent: Array<Record<string, unknown>> = [
    {
      type: 'input_text',
      text: 'Leia o arquivo e extraia a lista de medicamentos com suas quantidades.',
    },
  ]

  if (isImage) {
    userContent.push({
      type: 'input_image',
      image_url: `data:${file.type};base64,${base64Data}`,
      detail: 'auto',
    })
  } else if (isPdf) {
    userContent.push({
      type: 'input_file',
      filename: file.name,
      file_data: `data:${file.type};base64,${base64Data}`,
    })
  } else {
    userContent.push({
      type: 'input_text',
      text: new TextDecoder().decode(fileBytes),
    })
  }

  const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_PARSER_MODEL') || 'gpt-5.4-mini',
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: buildPrompt(),
            },
          ],
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'medication_list',
          strict: true,
          schema: buildSchema(),
        },
      },
    }),
  })

  const openAiPayload = await openAiResponse.json().catch(() => null)
  if (!openAiResponse.ok || !openAiPayload) {
    return errorResponse(
      502,
      'openai_request_failed',
      (openAiPayload as { error?: { message?: string } } | null)?.error?.message || 'Falha ao consultar a OpenAI.',
      context,
      { openai_status: openAiResponse.status },
    )
  }

  const outputText = extractOutputText(openAiPayload as Record<string, unknown>)
  if (!outputText) {
    return errorResponse(502, 'openai_empty_output', 'A OpenAI nao retornou uma resposta estruturada.', context)
  }

  let parsed: { items?: ParsedItem[] }
  try {
    parsed = JSON.parse(outputText)
  } catch (_error) {
    return errorResponse(502, 'openai_invalid_json', 'Nao foi possivel interpretar a resposta da OpenAI.', context)
  }

  const items = normalizeItems(Array.isArray(parsed.items) ? parsed.items : [])
  if (items.length === 0) {
    return errorResponse(422, 'no_valid_items', 'Nenhum item valido foi identificado no arquivo.', context)
  }

  logEvent('info', 'parse_completed', context, {
    item_count: items.length,
  })

  return jsonResponse({
    success: true,
    items,
    normalized_text: items.map((item) => `${item.query} | ${item.quantity}`).join('\n'),
    request_id: context.requestId,
  })
})

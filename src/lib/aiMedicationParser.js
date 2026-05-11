import { supabase } from './supabase'

const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
]

export async function extractMedicationListFromFile(file) {
  if (!file) {
    throw new Error('Selecione um arquivo antes de analisar.')
  }

  const isSupportedImage = file.type.startsWith('image/')
  const isSupportedFile = isSupportedImage || SUPPORTED_FILE_TYPES.includes(file.type)

  if (!isSupportedFile) {
    throw new Error('Formato nao suportado. Use PDF, imagem, TXT ou CSV.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw error
  }

  const session = data.session
  if (!session?.access_token) {
    throw new Error('Sessao expirada. Entre novamente para usar a analise por IA.')
  }

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-medication-list`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: formData,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.error || 'Falha ao analisar o arquivo com a OpenAI.')
  }

  return payload
}

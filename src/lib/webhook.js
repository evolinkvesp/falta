const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL;
const WEBHOOK_PEDIDO_URL = import.meta.env.VITE_WEBHOOK_PEDIDO_URL;

/**
 * Envia os dados da cotação para o n8n
 * @param {object} payload - Dados formatados da cotação
 */
export async function triggerWebhook(payload) {
  if (!WEBHOOK_URL) {
    console.error('Webhook URL missing');
    return { success: false, error: 'Configuração ausente' };
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    return { success: response.ok };
  } catch (error) {
    console.error('Error triggering Webhook:', error);
    return { success: false, error };
  }
}

/**
 * Envia os dados do pedido finalizado para o n8n
 * @param {object} payload - Dados do pedido (ex: { quoteId })
 */
export async function triggerPedidoWebhook(payload) {
  if (!WEBHOOK_PEDIDO_URL) {
    console.error('Webhook Pedido URL missing');
    return { success: false, error: 'Configuração ausente' };
  }

  try {
    const response = await fetch(WEBHOOK_PEDIDO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    return { success: response.ok };
  } catch (error) {
    console.error('Error triggering Pedido Webhook:', error);
    return { success: false, error };
  }
}

/**
 * Gera o link de cotação para o fornecedor
 */
export function generateSupplierLink(token) {
  return `${window.location.origin}${window.location.pathname}?token=${token}`;
}

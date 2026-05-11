export function parseQuoteText(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split(/[|;,]/)
      const query = parts[0]?.trim() || ''
      const quantity = Number.parseInt(parts[1], 10)

      return {
        tempId: index,
        query,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        status: 'pending',
      }
    })
    .filter((item) => item.query.length > 2)
}

export function stringifyQuoteItems(items) {
  return items
    .map((item) => `${item.query} | ${item.quantity}`)
    .join('\n')
}

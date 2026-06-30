import { jsonResponse, handleOptions } from './lib/utils.js'

export async function onRequest(context) {
  const opt = handleOptions(context.request)
  if (opt) return opt
  return jsonResponse({ status: 'ok' })
}

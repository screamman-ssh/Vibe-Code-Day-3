import { handleOptions } from '../../lib/utils.js'
import { handleApiRequest } from '../../lib/api.js'

export async function onRequest(context) {
  const opt = handleOptions(context.request)
  if (opt) return opt

  const path = context.params.path || ''
  return handleApiRequest(context.request, context.env, path)
}

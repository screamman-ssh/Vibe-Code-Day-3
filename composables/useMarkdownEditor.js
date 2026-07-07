export function wrapSelection(textarea, before, after = before) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const selected = value.slice(start, end)
  const next = `${value.slice(0, start)}${before}${selected || 'ข้อความ'}${after}${value.slice(end)}`
  textarea.value = next
  const cursor = start + before.length + (selected || 'ข้อความ').length + after.length
  textarea.setSelectionRange(cursor, cursor)
  textarea.focus()
  return next
}

export function prefixLines(textarea, prefix) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const block = value.slice(start, end) || 'รายการ'
  const lines = block.split('\n').map(line => `${prefix}${line}`)
  const next = `${value.slice(0, start)}${lines.join('\n')}${value.slice(end)}`
  textarea.value = next
  textarea.focus()
  return next
}

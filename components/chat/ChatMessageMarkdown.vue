<script setup>
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const props = defineProps({
  content: { type: String, default: '' },
  streaming: { type: Boolean, default: false }
})

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

const renderedHtml = computed(() => {
  if (!props.content) return ''
  const raw = md.render(props.content)
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'code', 'pre', 'blockquote', 'a', 'br', 'hr'],
    ALLOWED_ATTR: ['href', 'rel', 'target']
  })
})
</script>

<template>
  <div
    class="chat-markdown"
    :class="{ 'chat-markdown--streaming': streaming }"
    v-html="renderedHtml"
  />
</template>

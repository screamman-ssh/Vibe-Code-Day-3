<script setup>
import { computed } from 'vue'
import ChatMessageMarkdown from '~/components/chat/ChatMessageMarkdown.vue'
import { getPostDisplayText } from '~/composables/useSocialHelpers'

const props = defineProps({
  post: { type: Object, required: true },
  quoteText: { type: String, default: '' }
})

const isRichText = computed(() => {
  const type = props.post.postType
  return type === 'text' || type === 'quote' || !!props.quoteText
})

const markdownContent = computed(() => {
  if (props.quoteText) return props.quoteText
  if (props.post.postType === 'quote') return props.post.quoteText || props.post.content || ''
  return props.post.content || ''
})

const plainContent = computed(() => getPostDisplayText(props.post))
</script>

<template>
  <div v-if="isRichText && markdownContent" class="social-post-content">
    <ChatMessageMarkdown :content="markdownContent" />
  </div>
  <p v-else-if="plainContent" class="text-sm text-ink leading-relaxed font-medium whitespace-pre-wrap social-post-content">
    {{ plainContent }}
  </p>
</template>

<style scoped>
.social-post-content :deep(.chat-markdown) {
  font-size: 0.9375rem;
  font-weight: 400;
  line-height: 1.6;
  color: #0f172a;
}

.social-post-content :deep(.chat-markdown a) {
  color: #0284c7;
  text-decoration: none;
}

.social-post-content :deep(.chat-markdown a:hover) {
  text-decoration: underline;
}

.social-post-content :deep(.chat-markdown strong) {
  font-weight: 600;
}
</style>

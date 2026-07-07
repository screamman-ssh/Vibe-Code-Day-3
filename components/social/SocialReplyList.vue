<script setup>
import { computed } from 'vue'
import { buildReplyTree } from '~/composables/useSocialHelpers'
import SocialReplyThread from './SocialReplyThread.vue'

const props = defineProps({
  replies: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false }
})

const emit = defineEmits(['reply', 'like', 'delete'])

const replyTree = computed(() => buildReplyTree(props.replies))
</script>

<template>
  <div class="space-y-3">
    <p v-if="replies.length === 0" class="text-xs text-ink-muted text-center py-2">
      ยังไม่มีความคิดเห็น — เป็นคนแรกที่ตอบกลับ
    </p>
    <SocialReplyThread
      v-for="reply in replyTree"
      :key="reply.id"
      :reply="reply"
      :submitting="submitting"
      @reply="emit('reply', $event)"
      @like="emit('like', $event)"
      @delete="emit('delete', $event)"
    />
  </div>
</template>

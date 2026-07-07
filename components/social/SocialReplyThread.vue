<script setup>
import { ref } from 'vue'
import { Heart, Trash2, MessageCircle } from 'lucide-vue-next'
import { formatTimeAgo } from '~/composables/useSocialHelpers'
import SocialReplyComposer from './SocialReplyComposer.vue'

const props = defineProps({
  reply: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  submitting: { type: Boolean, default: false }
})

const emit = defineEmits(['reply', 'like', 'delete'])

const showComposer = ref(false)

function toggleComposer() {
  showComposer.value = !showComposer.value
}

function handleReply(content) {
  emit('reply', { parentReplyId: props.reply.id, content })
  showComposer.value = false
}
</script>

<template>
  <div
    class="space-y-2"
    :style="{ marginLeft: depth > 0 ? '12px' : '0' }"
  >
    <div
      class="relative pl-3"
      :class="depth > 0 ? 'border-l-2 border-border-subtle' : ''"
    >
      <div class="flex items-start gap-2">
        <img
          :src="reply.avatarUrl"
          class="w-7 h-7 rounded-full border border-border-subtle bg-slate-50 shrink-0 mt-0.5"
          alt=""
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-ink">{{ reply.displayName }}</span>
            <span class="text-micro text-ink-muted">{{ formatTimeAgo(reply.createdAt) }}</span>
            <button
              v-if="reply.isOwn"
              type="button"
              class="ml-auto p-1 text-ink-muted hover:text-tier-risk cursor-pointer"
              title="ลบความคิดเห็น"
              @click="emit('delete', reply.id)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
          <p class="text-sm text-ink leading-relaxed whitespace-pre-wrap mt-0.5">{{ reply.content }}</p>

          <div class="flex items-center gap-3 mt-1">
            <button
              type="button"
              class="flex items-center gap-1 text-micro font-bold text-ink-muted hover:text-primary cursor-pointer"
              @click="toggleComposer"
            >
              <MessageCircle class="w-3.5 h-3.5" />
              ตอบกลับ
            </button>
            <button
              type="button"
              class="flex items-center gap-1 text-micro font-bold cursor-pointer"
              :class="reply.isLiked ? 'text-red-500' : 'text-ink-muted hover:text-red-500'"
              @click="emit('like', reply.id)"
            >
              <Heart class="w-3.5 h-3.5" :class="reply.isLiked ? 'fill-current' : ''" />
              <span v-if="reply.likeCount > 0">{{ reply.likeCount }}</span>
            </button>
          </div>

          <div v-if="showComposer" class="mt-2">
            <SocialReplyComposer
              placeholder="ตอบกลับความคิดเห็น..."
              :submitting="submitting"
              @submit="handleReply"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="reply.children?.length" class="space-y-2">
      <SocialReplyThread
        v-for="child in reply.children"
        :key="child.id"
        :reply="child"
        :depth="depth + 1"
        :submitting="submitting"
        @reply="emit('reply', $event)"
        @like="emit('like', $event)"
        @delete="emit('delete', $event)"
      />
    </div>
  </div>
</template>

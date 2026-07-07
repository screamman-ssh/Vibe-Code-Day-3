<script setup>
import { computed } from 'vue'
import { formatTimeAgo } from '~/composables/useSocialHelpers'
import SocialPostContent from './SocialPostContent.vue'

const props = defineProps({
  post: { type: Object, required: true },
  compact: { type: Boolean, default: true }
})

const timeAgo = computed(() => formatTimeAgo(props.post.createdAt))
</script>

<template>
  <div
    class="rounded-xl border border-slate-200 bg-slate-50/80 p-3 mt-3"
    :class="compact ? 'text-sm' : ''"
  >
    <div class="flex items-center gap-2 mb-1.5">
      <img
        :src="post.avatarUrl"
        class="w-6 h-6 rounded-full border border-border-subtle bg-slate-50 shrink-0"
        alt=""
      />
      <span class="text-xs font-bold text-ink truncate">{{ post.displayName }}</span>
      <span class="text-micro text-ink-muted">{{ timeAgo }}</span>
    </div>
    <SocialPostContent :post="post" />
  </div>
</template>

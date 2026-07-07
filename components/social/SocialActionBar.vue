<script setup>
import { Heart, MessageCircle, Repeat2, Bookmark, MoreHorizontal } from 'lucide-vue-next'

defineProps({
  replyCount: { type: Number, default: 0 },
  repostCount: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 },
  isLiked: { type: Boolean, default: false },
  isReposted: { type: Boolean, default: false },
  isBookmarked: { type: Boolean, default: false },
  replyActive: { type: Boolean, default: false }
})

const emit = defineEmits(['like', 'reply', 'repost', 'bookmark', 'more'])
</script>

<template>
  <div class="flex items-center justify-between gap-2 pt-3">
    <div class="flex items-center gap-1 sm:gap-2">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
        :class="isLiked ? 'text-rose-500' : ''"
        @click="emit('like')"
      >
        <Heart class="w-[18px] h-[18px]" :class="isLiked ? 'fill-current' : ''" stroke-width="1.75" />
        <span v-if="likeCount > 0" class="text-xs font-medium tabular-nums">{{ likeCount }}</span>
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition"
        :class="isReposted
          ? 'text-emerald-600 cursor-default'
          : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer'"
        :disabled="isReposted"
        :title="isReposted ? 'รีโพสต์แล้ว' : 'รีโพสต์'"
        @click="emit('repost')"
      >
        <Repeat2 class="w-[18px] h-[18px]" stroke-width="1.75" />
        <span v-if="repostCount > 0" class="text-xs font-medium tabular-nums">{{ repostCount }}</span>
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
        :class="replyActive ? 'text-sky-600' : ''"
        @click="emit('reply')"
      >
        <MessageCircle class="w-[18px] h-[18px]" stroke-width="1.75" />
        <span v-if="replyCount > 0" class="text-xs font-medium tabular-nums">{{ replyCount }}</span>
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
        :class="isBookmarked ? 'text-sky-600' : ''"
        @click="emit('bookmark')"
      >
        <Bookmark class="w-[18px] h-[18px]" :class="isBookmarked ? 'fill-current' : ''" stroke-width="1.75" />
      </button>
    </div>

    <button
      type="button"
      class="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer !px-2"
      @click="emit('more')"
    >
      <MoreHorizontal class="w-[18px] h-[18px]" stroke-width="1.75" />
    </button>
  </div>
</template>

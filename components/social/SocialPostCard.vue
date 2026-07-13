<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from '#imports'
import { useAuthStore } from '~/stores/auth'
import { useSocialStore } from '~/stores/social'
import { formatFeedTime, getThreadRootId, getUserHandle } from '~/composables/useSocialHelpers'
import { confirmDialog } from '~/composables/useConfirmDialog'
import SocialActionBar from './SocialActionBar.vue'
import SocialEmbedPost from './SocialEmbedPost.vue'
import SocialPostContent from './SocialPostContent.vue'
import SocialReplyComposer from './SocialReplyComposer.vue'
import SocialReplyList from './SocialReplyList.vue'
import { Repeat2, Flag, Trash2 } from 'lucide-vue-next'

const props = defineProps({
  post: { type: Object, required: true },
  showProfileLink: { type: Boolean, default: true }
})

const emit = defineEmits(['deleted'])

const router = useRouter()
const authStore = useAuthStore()
const socialStore = useSocialStore()

const showReplies = ref(false)
const showPostMenu = ref(false)
const isSubmittingReply = ref(false)
const isReposting = ref(false)
const replies = ref([])

const isOwn = computed(() => authStore.user?.id === props.post.userId)
const threadRootId = computed(() => getThreadRootId(props.post))
const feedTime = computed(() => formatFeedTime(props.post.createdAt))
const userHandle = computed(() => getUserHandle(props.post.displayName))
const isRepost = computed(() => props.post.postType === 'repost' || props.post.postType === 'quote')
const isQuote = computed(() => props.post.postType === 'quote')
const isGroupPost = computed(() => props.post.source === 'group')
const isReported = computed(() => socialStore.isPostReported(props.post.id))
const isBookmarked = computed(() => socialStore.isPostBookmarked(props.post.id))

const replyPreviewAvatars = computed(() => {
  const cache = socialStore.replyCache[threadRootId.value] || replies.value
  return cache.slice(0, 2).map(r => r.avatarUrl)
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function handleClickOutside(e) {
  if (!e.target.closest?.('[data-post-menu]')) {
    showPostMenu.value = false
  }
}

function goProfile() {
  if (props.showProfileLink) {
    router.push(`/social/${props.post.userId}`)
  }
}

async function openReplies() {
  showReplies.value = true
  if (replies.value.length === 0) {
    replies.value = await socialStore.fetchReplies(threadRootId.value)
  }
}

async function toggleReplies() {
  if (showReplies.value) {
    showReplies.value = false
    return
  }
  await openReplies()
}

async function handleLike() {
  try {
    await socialStore.toggleLike(props.post.id, props.post)
  } catch (err) {
    console.error('Like failed:', err)
  }
}

function handleBookmark() {
  socialStore.toggleBookmark(props.post.id)
}

async function handleRepost() {
  if (isReposting.value || isOwn.value || props.post.isReposted) return
  isReposting.value = true
  try {
    await socialStore.repost(threadRootId.value, 'simple')
  } catch (err) {
    console.error('Repost failed:', err)
  } finally {
    isReposting.value = false
  }
}

function togglePostMenu() {
  showPostMenu.value = !showPostMenu.value
}

async function handleReport() {
  if (isOwn.value || isReported.value) return
  const ok = await confirmDialog('รายงานโพสต์นี้ว่าไม่เหมาะสม?')
  if (!ok) return
  socialStore.reportPost(props.post.id)
  showPostMenu.value = false
}

async function handleTopLevelReply(content) {
  isSubmittingReply.value = true
  try {
    await socialStore.createReply(threadRootId.value, content, null, props.post)
    replies.value = [...(socialStore.replyCache[threadRootId.value] || [])]
  } catch (err) {
    console.error('Reply failed:', err)
  } finally {
    isSubmittingReply.value = false
  }
}

async function handleNestedReply({ parentReplyId, content }) {
  isSubmittingReply.value = true
  try {
    await socialStore.createReply(threadRootId.value, content, parentReplyId, props.post)
    replies.value = [...(socialStore.replyCache[threadRootId.value] || [])]
  } catch (err) {
    console.error('Nested reply failed:', err)
  } finally {
    isSubmittingReply.value = false
  }
}

async function handleReplyLike(replyId) {
  try {
    await socialStore.toggleReplyLike(threadRootId.value, replyId)
    replies.value = [...(socialStore.replyCache[threadRootId.value] || [])]
  } catch (err) {
    console.error('Reply like failed:', err)
  }
}

async function handleReplyDelete(replyId) {
  const ok = await confirmDialog('ลบความคิดเห็นนี้?', { variant: 'danger' })
  if (!ok) return
  try {
    await socialStore.deleteReply(threadRootId.value, replyId)
    replies.value = [...(socialStore.replyCache[threadRootId.value] || [])]
    props.post.replyCount = Math.max(0, (props.post.replyCount || 0) - 1)
  } catch (err) {
    console.error('Reply delete failed:', err)
  }
}

async function handleDeletePost() {
  const ok = await confirmDialog('ลบโพสต์นี้?', { variant: 'danger' })
  if (!ok) return
  try {
    await socialStore.deletePost(props.post.id)
    emit('deleted', props.post.id)
  } catch (err) {
    console.error('Delete post failed:', err)
  } finally {
    showPostMenu.value = false
  }
}
</script>

<template>
  <article class="bg-surface-card rounded-xl border border-border-subtle px-4 py-4 sm:px-5 hover:border-border-subtle/80 transition-colors">
    <div class="flex gap-3">
      <button
        type="button"
        class="shrink-0 mt-0.5"
        :class="showProfileLink ? 'cursor-pointer hover:opacity-80' : ''"
        @click="goProfile"
      >
        <img :src="post.avatarUrl" class="w-10 h-10 rounded-full bg-slate-100 object-cover" alt="" />
      </button>

      <div class="flex-1 min-w-0">
        <button
          type="button"
          class="text-left w-full"
          :class="showProfileLink ? 'cursor-pointer' : ''"
          @click="goProfile"
        >
          <div class="flex items-center gap-1 flex-wrap text-sm leading-tight">
            <span class="font-semibold text-ink">{{ post.displayName }}</span>
            <span class="text-slate-500">@{{ userHandle }}</span>
            <span v-if="isGroupPost" class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              กลุ่ม
            </span>
            <span class="text-slate-400">·</span>
            <span class="text-slate-500">{{ feedTime }}</span>
          </div>
        </button>

        <div v-if="isRepost && !isQuote" class="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
          <Repeat2 class="w-3.5 h-3.5" />
          {{ post.displayName }} รีโพสต์
        </div>

        <div class="mt-2 text-[15px] leading-relaxed text-ink">
          <SocialPostContent :post="post" />
        </div>

        <SocialEmbedPost v-if="post.repostOf" :post="post.repostOf" class="mt-3" />

        <div v-if="!isGroupPost" class="relative" data-post-menu>
          <SocialActionBar
            :reply-count="post.replyCount"
            :repost-count="post.repostCount"
            :like-count="post.likeCount"
            :is-liked="post.isLiked"
            :is-reposted="post.isReposted"
            :is-bookmarked="isBookmarked"
            :reply-active="showReplies"
            @like="handleLike"
            @reply="toggleReplies"
            @repost="handleRepost"
            @bookmark="handleBookmark"
            @more="togglePostMenu"
          />

          <div
            v-if="showPostMenu"
            class="absolute right-0 top-full mt-1 z-20 w-40 bg-surface-card border border-border-subtle rounded-xl shadow-lg py-1"
          >
            <button
              v-if="!isOwn"
              type="button"
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              :disabled="isReported"
              @click.stop="handleReport"
            >
              <Flag class="w-4 h-4" />
              {{ isReported ? 'รายงานแล้ว' : 'รายงานโพสต์' }}
            </button>
            <button
              v-if="isOwn"
              type="button"
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
              @click.stop="handleDeletePost"
            >
              <Trash2 class="w-4 h-4" />
              ลบโพสต์
            </button>
          </div>
        </div>

        <button
          v-if="!isGroupPost && post.replyCount > 0 && !showReplies"
          type="button"
          class="mt-2 inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700 cursor-pointer"
          @click="openReplies"
        >
          <span class="inline-flex -space-x-1.5">
            <img
              v-for="(avatar, idx) in replyPreviewAvatars"
              :key="idx"
              :src="avatar"
              class="w-5 h-5 rounded-full border-2 border-white bg-slate-100"
              alt=""
            />
          </span>
          แสดงความคิดเห็น ({{ post.replyCount }})
        </button>

        <div v-if="!isGroupPost && showReplies" class="mt-3 pl-1 space-y-3 border-l-2 border-slate-100 ml-1">
          <SocialReplyComposer
            :submitting="isSubmittingReply"
            @submit="handleTopLevelReply"
          />
          <SocialReplyList
            :replies="replies"
            :submitting="isSubmittingReply"
            @reply="handleNestedReply"
            @like="handleReplyLike"
            @delete="handleReplyDelete"
          />
        </div>
      </div>
    </div>
  </article>
</template>

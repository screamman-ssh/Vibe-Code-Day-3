<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from '#imports'
import { useSocialStore } from '~/stores/social'
import SocialPostCard from '~/components/social/SocialPostCard.vue'
import { ArrowLeft, UserPlus, UserCheck, Flame } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const socialStore = useSocialStore()

const profile = ref(null)
const posts = ref([])
const isLoading = ref(true)
const loadError = ref('')

const userId = computed(() => route.params.id)

onMounted(async () => {
  await loadProfile()
})

async function loadProfile() {
  isLoading.value = true
  loadError.value = ''
  try {
    const data = await socialStore.fetchUserProfile(userId.value)
    profile.value = data.profile
    posts.value = data.posts
  } catch (err) {
    loadError.value = err.message || 'โหลดโปรไฟล์ไม่สำเร็จ'
  } finally {
    isLoading.value = false
  }
}

async function toggleFollow() {
  if (!profile.value || profile.value.isSelf) return
  try {
    if (profile.value.isFollowing) {
      await socialStore.unfollowUser(profile.value.id)
      profile.value.isFollowing = false
      profile.value.followersCount = Math.max(0, profile.value.followersCount - 1)
    } else {
      await socialStore.followUser(profile.value.id)
      profile.value.isFollowing = true
      profile.value.followersCount += 1
    }
  } catch (err) {
    console.error('Follow toggle failed:', err)
  }
}

function handlePostDeleted(postId) {
  posts.value = posts.value.filter(p => p.id !== postId)
}

function goBack() {
  router.push('/social')
}
</script>

<template>
  <div class="page-shell">
    <button
      type="button"
      class="flex items-center gap-2 text-sm font-bold text-ink-muted hover:text-ink mb-4 cursor-pointer"
      @click="goBack"
    >
      <ArrowLeft class="w-4 h-4" />
      กลับไปชุมชน
    </button>

    <div v-if="isLoading" class="text-center py-12 text-ink-muted text-sm">กำลังโหลด...</div>

    <div v-else-if="loadError" class="text-center py-12 text-tier-risk text-sm font-semibold">
      {{ loadError }}
    </div>

    <template v-else-if="profile">
      <div class="surface-card p-5 border-2 border-border-subtle rounded-xl space-y-4 mb-5">
        <div class="flex items-start gap-4">
          <img
            :src="profile.avatarUrl"
            class="w-16 h-16 rounded-full border-2 border-border-subtle shrink-0"
            alt=""
          />
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-black font-brand text-ink">{{ profile.displayName }}</h1>
            <p v-if="profile.bio" class="text-sm text-ink-muted mt-1">{{ profile.bio }}</p>
            <div class="flex items-center gap-3 mt-2 text-xs font-bold text-ink-muted">
              <span>{{ profile.followersCount }} ผู้ติดตาม</span>
              <span>{{ profile.followingCount }} กำลังติดตาม</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-border-subtle pt-3">
          <div class="flex items-center gap-4">
            <div class="flex flex-col">
              <span class="text-lg font-brand font-black text-ink">{{ profile.score }}</span>
              <span class="text-micro text-ink-muted uppercase">คะแนน</span>
            </div>
            <div class="flex flex-col">
              <span class="text-sm font-bold text-ink">{{ profile.tierTh }}</span>
              <span class="text-micro text-ink-muted uppercase">ระดับ</span>
            </div>
            <div class="flex items-center gap-1 text-sm font-bold text-streak-flame">
              <Flame class="w-4 h-4 fill-streak-flame" />
              <span>{{ profile.streakDays }} วัน</span>
            </div>
          </div>

          <button
            v-if="!profile.isSelf"
            type="button"
            class="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold cursor-pointer transition"
            :class="profile.isFollowing
              ? 'bg-surface-bg border-2 border-border-subtle text-ink-muted'
              : 'bg-primary text-white hover:opacity-90'"
            @click="toggleFollow"
          >
            <UserCheck v-if="profile.isFollowing" class="w-4 h-4" />
            <UserPlus v-else class="w-4 h-4" />
            {{ profile.isFollowing ? 'ติดตามแล้ว' : 'ติดตาม' }}
          </button>
        </div>
      </div>

      <h2 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider mb-3">โพสต์</h2>

      <div class="space-y-3">
        <SocialPostCard
          v-for="post in posts"
          :key="post.id"
          :post="post"
          :show-profile-link="false"
          @deleted="handlePostDeleted"
        />
      </div>

      <p v-if="posts.length === 0" class="text-center text-sm text-ink-muted py-8">
        ยังไม่มีโพสต์
      </p>
    </template>
  </div>
</template>

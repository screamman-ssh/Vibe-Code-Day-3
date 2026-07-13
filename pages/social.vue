<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from '#imports'
import { useAuthStore } from '~/stores/auth'
import { useSocialStore } from '~/stores/social'
import PageBanner from '~/components/layout/PageBanner.vue'
import SocialPostCard from '~/components/social/SocialPostCard.vue'
import SocialFeedComposer from '~/components/social/SocialFeedComposer.vue'
import SocialFeedFilter from '~/components/social/SocialFeedFilter.vue'
import { Globe, Search, UserPlus, UserCheck, Users } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const socialStore = useSocialStore()

const currentTab = ref('feed')
const searchQuery = ref('')
const newPostContent = ref('')
const isPosting = ref(false)
const postError = ref('')

const userAvatar = computed(() => {
  const name = authStore.user?.displayName || 'User'
  return authStore.user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
})

onMounted(async () => {
  await Promise.all([
    socialStore.fetchFeed(),
    socialStore.fetchDiscover()
  ])
})

async function handleSearch() {
  await socialStore.fetchDiscover(searchQuery.value)
}

async function handlePost() {
  if (!newPostContent.value.trim()) return
  isPosting.value = true
  postError.value = ''
  try {
    await socialStore.createPost(newPostContent.value.trim())
    newPostContent.value = ''
  } catch (err) {
    postError.value = err.message || 'โพสต์ไม่สำเร็จ'
  } finally {
    isPosting.value = false
  }
}

async function toggleFollow(user) {
  try {
    if (user.isFollowing) {
      await socialStore.unfollowUser(user.id)
      user.isFollowing = false
    } else {
      await socialStore.followUser(user.id)
      user.isFollowing = true
      await socialStore.fetchFeed(socialStore.feedFilter)
    }
  } catch (err) {
    console.error('Follow toggle failed:', err)
  }
}

async function handleFeedFilterChange(scope) {
  await socialStore.fetchFeed(scope)
}

function goProfile(userId) {
  router.push(`/social/${userId}`)
}
</script>

<template>
  <div class="page-shell social-page max-w-2xl mx-auto">
    <PageBanner
      title="ชุมชนการเงิน"
      lead="ติดตามเพื่อน รับโพสต์และความเคลื่อนไหวด้านการเงิน"
      class="!mb-3"
    >
      <template #icon>
        <Globe class="w-5 h-5" />
      </template>
    </PageBanner>

    <div class="tab-switch">
      <button
        type="button"
        class="tab-switch-btn"
        :class="currentTab === 'feed' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
        @click="currentTab = 'feed'"
      >
        ฟีดของฉัน
      </button>
      <button
        type="button"
        class="tab-switch-btn"
        :class="currentTab === 'discover' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
        @click="currentTab = 'discover'"
      >
        ค้นหาคน
      </button>
    </div>

    <div v-if="currentTab === 'feed'" class="animate-fade-in space-y-4">
      <section class="surface-card-sm overflow-hidden !p-0 shadow-sm">
        <SocialFeedFilter
          :model-value="socialStore.feedFilter"
          @update:model-value="handleFeedFilterChange"
        />

        <div v-if="socialStore.feedFilter !== 'group'" class="p-4 border-t-2 border-border-subtle">
          <SocialFeedComposer
            v-model="newPostContent"
            :disabled="isPosting"
            :submitting="isPosting"
            @submit="handlePost"
          />
          <p v-if="postError" class="text-xs text-tier-risk font-semibold mt-2">{{ postError }}</p>
          <p class="text-micro text-ink-muted mt-2 text-right">{{ newPostContent.length }}/500</p>
        </div>
      </section>

      <div
        v-if="socialStore.feedFilter === 'following' && socialStore.followingCount === 0"
        class="py-8 text-center space-y-2 border border-dashed border-slate-200 rounded-xl bg-white"
      >
        <Users class="w-8 h-8 mx-auto text-slate-400" />
        <p class="text-sm font-semibold text-ink">ยังไม่ได้ติดตามใคร</p>
        <p class="text-xs text-slate-500">ไปที่แท็บ "ค้นหาคน" เพื่อติดตามและรับโพสต์ในฟีด</p>
        <button type="button" class="btn-secondary text-sm mt-2 cursor-pointer" @click="currentTab = 'discover'">
          ค้นหาคนติดตาม
        </button>
      </div>

      <div
        v-if="socialStore.feedFilter === 'group' && !socialStore.hasGroup"
        class="py-8 text-center space-y-2 border border-dashed border-slate-200 rounded-xl bg-white"
      >
        <Users class="w-8 h-8 mx-auto text-slate-400" />
        <p class="text-sm font-semibold text-ink">ยังไม่ได้เข้าร่วมกลุ่ม</p>
        <p class="text-xs text-slate-500">เข้าร่วมกลุ่มเพื่อดูกิจกรรมและความเคลื่อนไหวของสมาชิก</p>
        <NuxtLink to="/circle" class="btn-secondary text-sm mt-2 inline-block">
          ไปที่กลุ่ม
        </NuxtLink>
      </div>

      <div class="space-y-3">
        <SocialPostCard
          v-for="post in socialStore.feedPosts"
          :key="post.id"
          :post="post"
        />

        <p
          v-if="socialStore.feedPosts.length === 0 && socialStore.feedFilter === 'public'"
          class="text-center text-sm text-slate-500 py-10 bg-white rounded-xl border border-slate-200/80"
        >
          ยังไม่มีโพสต์สาธารณะ — ลองโพสต์อะไรสักอย่าง!
        </p>

        <p
          v-if="socialStore.feedPosts.length === 0 && socialStore.feedFilter === 'following' && socialStore.followingCount > 0"
          class="text-center text-sm text-slate-500 py-10 bg-white rounded-xl border border-slate-200/80"
        >
          ยังไม่มีโพสต์ในฟีด — ลองโพสต์อะไรสักอย่าง!
        </p>

        <p
          v-if="socialStore.feedPosts.length === 0 && socialStore.feedFilter === 'group' && socialStore.hasGroup"
          class="text-center text-sm text-slate-500 py-10 bg-white rounded-xl border border-slate-200/80"
        >
          ยังไม่มีกิจกรรมในกลุ่ม{{ socialStore.groupName ? ` ${socialStore.groupName}` : '' }}
        </p>
      </div>
    </div>

    <div v-else class="animate-fade-in space-y-4">
      <section class="surface-card-sm shadow-sm">
        <label for="social-user-search" class="sr-only">ค้นหาชื่อผู้ใช้</label>
        <div class="relative">
          <Search class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" aria-hidden="true" />
          <input
            id="social-user-search"
            v-model="searchQuery"
            type="search"
            placeholder="ค้นหาชื่อผู้ใช้..."
            class="input-field !pl-10 bg-surface-bg border-border-subtle"
            @keyup.enter="handleSearch"
          />
        </div>
      </section>

      <div class="space-y-3">
        <div
          v-for="user in socialStore.discoverUsers"
          :key="user.id"
          class="flex items-center gap-3 p-3 bg-white border border-slate-200/80 rounded-2xl"
        >
          <button type="button" class="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer" @click="goProfile(user.id)">
            <img :src="user.avatarUrl" class="w-10 h-10 rounded-full bg-slate-100 shrink-0" alt="" />
            <div class="min-w-0">
              <p class="text-sm font-semibold text-ink truncate">{{ user.displayName }}</p>
              <p class="text-caption text-slate-500 truncate">{{ user.bio || user.tierTh }}</p>
              <p class="text-micro text-slate-400 mt-0.5">{{ user.score }} คะแนน · บันทึก {{ user.streakDays }} วัน</p>
            </div>
          </button>

          <button
            type="button"
            class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold cursor-pointer transition"
            :class="user.isFollowing
              ? 'bg-surface-bg text-ink-muted hover:text-tier-risk border-2 border-border-subtle'
              : 'bg-primary text-white hover:bg-accent-emerald-hover'"
            :style="!user.isFollowing ? { boxShadow: '0 2px 0 #861212' } : undefined"
            @click.stop="toggleFollow(user)"
          >
            <UserCheck v-if="user.isFollowing" class="w-3.5 h-3.5" />
            <UserPlus v-else class="w-3.5 h-3.5" />
            {{ user.isFollowing ? 'ติดตามแล้ว' : 'ติดตาม' }}
          </button>
        </div>

        <p v-if="socialStore.discoverUsers.length === 0" class="text-center text-sm text-slate-500 py-8 bg-white rounded-xl border border-slate-200/80">
          ไม่พบผู้ใช้
        </p>
      </div>
    </div>
  </div>
</template>

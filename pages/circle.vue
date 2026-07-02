<script setup>
import { ref, computed } from 'vue'
import { useGroupStore, useAuthStore } from '#imports'
import HexBadge from '~/components/score/HexBadge.vue'
import { Users, Copy, Share2, MessageCircle, Flame, Check } from 'lucide-vue-next'

const groupStore = useGroupStore()
const authStore = useAuthStore()

const currentTab = ref('leaderboard') // 'leaderboard' or 'feed'
const copied = ref(false)

const group = computed(() => groupStore.currentGroup)
const currentUser = computed(() => authStore.user || { displayName: '' })

const ranks = ['gold', 'silver', 'bronze', 'blue']

function getBadgeVariant(index) {
  if (index === 0) return 'gold'
  if (index === 1) return 'silver'
  if (index === 2) return 'bronze'
  return 'blue'
}

function handleCopyInvite() {
  navigator.clipboard.writeText(group.value.inviteCode)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function handleReact(eventId, emoji) {
  groupStore.reactToEvent(eventId, emoji)
}

const formatEventText = (e) => {
  switch (e.eventType) {
    case 'score_changed':
      return `มีคะแนนเปลี่ยนเป็น ${e.payload.new_score} คะแนน (${e.payload.tier})`
    case 'badge_earned':
      return `ปลดล็อกตราเกียรติยศ "${e.payload.badge_name}" 🎉`
    case 'challenge_completed':
      return `ทำภารกิจสำเร็จ: ${e.payload.challenge_name} 👍`
    default:
      return 'อัปเดตกิจกรรมประจำวัน'
  }
}
</script>

<template>
  <div class="page-shell">
    
    <!-- Circle Header -->
    <div class="surface-card p-5 space-y-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Users class="w-5 h-5" />
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-ink-muted leading-none">กลุ่มของคุณ</span>
          <h2 class="text-base font-bold text-ink mt-1.5 leading-none">{{ group.name }}</h2>
        </div>
      </div>

      <div class="flex items-center justify-between border-t border-border-subtle pt-3 text-xs">
        <div class="flex flex-col">
          <span class="text-[10px] text-ink-muted leading-none">รหัสเข้าร่วมกลุ่ม</span>
          <span class="text-sm font-brand font-black text-ink mt-1 flex items-center gap-2 select-all">
            {{ group.inviteCode }}
            <button 
              @click="handleCopyInvite"
              class="p-1 hover:bg-slate-100 rounded text-ink-muted hover:text-ink cursor-pointer"
            >
              <Check v-if="copied" class="w-3.5 h-3.5 text-accent-emerald" />
              <Copy v-else class="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
        <div class="flex flex-col text-right">
          <span class="text-[10px] text-ink-muted leading-none">สมาชิกทั้งหมด</span>
          <span class="text-sm font-bold text-ink mt-1">{{ group.membersCount }} / {{ group.maxMembers }} คน</span>
        </div>
      </div>
    </div>

    <!-- Tab Switchers (Mobile Only) -->
    <div class="tab-switch md:hidden">
      <button 
        @click="currentTab = 'leaderboard'"
        class="tab-switch-btn"
        :class="currentTab === 'leaderboard' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
      >
        ตารางอันดับ
      </button>
      <button 
        @click="currentTab = 'feed'"
        class="tab-switch-btn"
        :class="currentTab === 'feed' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
      >
        กิจกรรมกลุ่ม
      </button>
    </div>

    <!-- Responsive Layout Columns -->
    <div class="flex flex-col md:grid md:grid-cols-3 md:gap-6 items-start gap-5">
      
      <!-- Leaderboard Column -->
      <div 
        class="w-full md:col-span-2 space-y-3"
        :class="currentTab === 'leaderboard' ? 'block' : 'hidden md:block'"
      >
        <h3 class="hidden md:block text-xs font-extrabold text-ink-muted uppercase tracking-wider mb-1">ตารางอันดับกลุ่ม (Leaderboard)</h3>
        <div 
          v-for="(member, index) in groupStore.leaderboard" 
          :key="member.displayName"
          class="surface-card-sm flex items-center justify-between transition-colors border"
          :class="member.displayName === currentUser.displayName ? 'border-accent-emerald/40 bg-emerald-50/10' : 'border-border-subtle'"
        >
          <!-- Left: Rank + Avatar + Name -->
          <div class="flex items-center gap-3">
            <HexBadge 
              :variant="getBadgeVariant(index)"
              size="sm"
              :rank="index + 1"
            />
            
            <img :src="member.avatarUrl" class="w-8 h-8 rounded-full border border-border-subtle bg-slate-50 shrink-0" />
            
            <div class="flex flex-col">
              <span class="text-sm font-bold text-ink flex items-center gap-1.5 leading-none">
                {{ member.displayName }}
                <span 
                  v-if="member.displayName === currentUser.displayName"
                  class="text-[9px] font-black bg-accent-emerald/10 text-accent-emerald px-1.5 py-0.5 rounded-full"
                >
                  คุณ
                </span>
              </span>
              <span class="text-[10px] text-ink-muted mt-1 leading-none">
                {{ member.tierTh }} · บันทึก {{ member.streakDays }} วันติด
              </span>
            </div>
          </div>

          <!-- Right: Score + Streak Indicator -->
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1 text-xs font-bold text-streak-flame">
              <Flame class="w-4 h-4 fill-streak-flame" />
              <span>{{ member.streakDays }}</span>
            </div>
            
            <div class="flex flex-col text-right">
              <span class="text-base font-brand font-black text-ink leading-none">{{ member.score }}</span>
              <span class="text-[9px] text-ink-muted mt-1 leading-none uppercase">คะแนน</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity Feed Column -->
      <div 
        class="w-full md:col-span-1 space-y-3"
        :class="currentTab === 'feed' ? 'block' : 'hidden md:block'"
      >
        <h3 class="hidden md:block text-xs font-extrabold text-ink-muted uppercase tracking-wider mb-1">กิจกรรมล่าสุด (Activity Feed)</h3>
        <div 
          v-for="e in groupStore.feedEvents" 
          :key="e.id"
          class="surface-card p-4 space-y-3"
        >
          <!-- Header -->
          <div class="flex items-center gap-2">
            <img :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${e.displayName}`" class="w-6 h-6 rounded-full bg-slate-100" />
            <span class="text-xs font-bold text-ink">{{ e.displayName }}</span>
            <span class="text-[9px] text-ink-muted ml-auto">เมื่อกี้นี้</span>
          </div>

          <!-- Event content -->
          <p class="text-xs text-ink leading-relaxed pl-1">
            {{ formatEventText(e) }}
          </p>

          <!-- Reactions row -->
          <div class="flex items-center gap-1.5 border-t border-border-subtle pt-2.5">
            <!-- Render existing reaction counters -->
            <button 
              v-for="(count, emoji) in e.reactions"
              :key="emoji"
              @click="handleReact(e.id, emoji)"
              class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-bg border border-border-subtle hover:bg-slate-100 transition text-[10px] font-bold text-ink cursor-pointer"
            >
              <span>{{ emoji }}</span>
              <span>{{ count }}</span>
            </button>

            <!-- Reaction Quick Add buttons -->
            <div class="flex gap-1 ml-auto">
              <button 
                v-for="emoji in ['👍', '🎉', '👏', '❤️']" 
                :key="emoji"
                @click="handleReact(e.id, emoji)"
                class="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded-full text-xs cursor-pointer select-none"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>

<style scoped>
/* Scoped styles */
</style>

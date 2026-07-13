<script setup>
import { ref, computed, onMounted } from 'vue'
import { useGroupStore, useAuthStore } from '#imports'
import HexBadge from '~/components/score/HexBadge.vue'
import { Users, Copy, Share2, Flame, Check, LogOut } from 'lucide-vue-next'
import { confirmDialog } from '~/composables/useConfirmDialog'
import { formatTimeAgo } from '~/composables/useSocialHelpers'

const groupStore = useGroupStore()
const authStore = useAuthStore()

const currentTab = ref('leaderboard')
const copied = ref(false)
const isLeaving = ref(false)

const newGroupName = ref('')
const joinInviteCode = ref('')
const isCreating = ref(false)
const isJoining = ref(false)
const groupError = ref('')

const group = computed(() => groupStore.currentGroup)
const currentUser = computed(() => authStore.user || { displayName: '' })
const isSoloGroup = computed(() => group.value?.membersCount === 1)
const hasFeedEvents = computed(() => groupStore.feedEvents.length > 0)

onMounted(() => {
  groupStore.fetchGroupDetails()
})

function getBadgeVariant(index) {
  if (index === 0) return 'gold'
  if (index === 1) return 'silver'
  if (index === 2) return 'bronze'
  return 'blue'
}

function handleCopyInvite() {
  if (group.value?.inviteCode) {
    navigator.clipboard.writeText(group.value.inviteCode)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

function handleReact(eventId, emoji) {
  groupStore.reactToEvent(eventId, emoji)
}

async function handleCreateGroup() {
  if (!newGroupName.value.trim()) return
  isCreating.value = true
  groupError.value = ''
  try {
    await groupStore.createGroup(newGroupName.value.trim())
    newGroupName.value = ''
  } catch (err) {
    groupError.value = err.message || 'สร้างกลุ่มล้มเหลว'
  } finally {
    isCreating.value = false
  }
}

async function handleJoinGroup() {
  if (!joinInviteCode.value.trim()) return
  isJoining.value = true
  groupError.value = ''
  try {
    await groupStore.joinGroupByCode(joinInviteCode.value.trim())
    joinInviteCode.value = ''
  } catch (err) {
    groupError.value = err.message || 'เข้าร่วมกลุ่มล้มเหลว'
  } finally {
    isJoining.value = false
  }
}

async function handleLeaveGroup() {
  const confirmed = await confirmDialog(
    'คุณต้องการออกจากกลุ่มนี้หรือไม่? หากคุณเป็นเจ้าของกลุ่ม สิทธิ์จะถูกโอนให้สมาชิกคนแรก หรือกลุ่มจะถูกลบหากเหลือคนเดียว',
    {
      title: 'ออกจากกลุ่ม',
      confirmText: 'ออกจากกลุ่ม',
      cancelText: 'ยกเลิก',
      variant: 'danger'
    }
  )
  if (!confirmed) return

  isLeaving.value = true
  groupError.value = ''
  try {
    await groupStore.leaveGroup()
  } catch (err) {
    groupError.value = err.message || 'ออกจากกลุ่มล้มเหลว'
  } finally {
    isLeaving.value = false
  }
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
    
    <!-- Case A: User has NO Group -->
    <div v-if="!group" class="max-w-md mx-auto space-y-6 py-6 animate-fade-in">
      <div class="text-center space-y-2">
        <h2 class="text-2xl font-black font-brand text-ink">กลุ่มเพื่อน (MoneyCircle)</h2>
        <p class="text-xs font-semibold text-ink-muted leading-relaxed uppercase tracking-wider">
          แข่งคุมเงิน รักษาวินัยไปพร้อมกับกลุ่มเพื่อนของคุณ
        </p>
      </div>

      <!-- Create Group Card -->
      <div class="surface-card p-6 border-2 border-border-subtle rounded-xl space-y-4">
        <h3 class="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
          <Users class="w-5 h-5 text-primary" />
          <span>สร้างกลุ่มใหม่</span>
        </h3>
        <div class="space-y-3">
          <input 
            v-model="newGroupName"
            type="text" 
            placeholder="ตั้งชื่อกลุ่มใหม่ของคุณ..." 
            class="input-field"
            @keyup.enter="handleCreateGroup"
          />
          <button 
            @click="handleCreateGroup"
            class="btn-primary w-full justify-center text-sm cursor-pointer"
            :disabled="isCreating || !newGroupName.trim()"
          >
            {{ isCreating ? 'กำลังสร้าง...' : 'สร้างกลุ่ม' }}
          </button>
        </div>
      </div>

      <!-- Join Group Card -->
      <div class="surface-card p-6 border-2 border-border-subtle rounded-xl space-y-4">
        <h3 class="text-sm font-black text-ink uppercase tracking-wider flex items-center gap-2">
          <Share2 class="w-5 h-5 text-primary" />
          <span>เข้าร่วมกลุ่มที่มีอยู่</span>
        </h3>
        <div class="space-y-3">
          <input 
            v-model="joinInviteCode"
            type="text" 
            placeholder="กรอกรหัสเชิญกลุ่ม..." 
            class="input-field uppercase"
            @keyup.enter="handleJoinGroup"
          />
          <button 
            @click="handleJoinGroup"
            class="btn-secondary w-full justify-center text-sm cursor-pointer"
            :disabled="isJoining || !joinInviteCode.trim()"
          >
            {{ isJoining ? 'กำลังเข้าร่วม...' : 'เข้าร่วมกลุ่ม' }}
          </button>
        </div>
      </div>
      
      <p v-if="groupError" class="text-xs font-semibold text-tier-risk text-center mt-2">{{ groupError }}</p>
    </div>

    <!-- Case B: User has a Group -->
    <div v-else class="space-y-5 animate-fade-in">
      
      <!-- Circle Header -->
      <div class="surface-card p-5 space-y-4 border-2 border-border-subtle rounded-xl bg-surface-card">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Users class="w-5 h-5" />
          </div>
          <div class="flex flex-col flex-1 min-w-0">
            <span class="text-xs text-ink-muted leading-none">กลุ่มของคุณ</span>
            <h2 class="text-base font-bold text-ink mt-1.5 leading-none truncate">{{ group?.name }}</h2>
          </div>
          <button
            @click="handleLeaveGroup"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-tier-risk border border-tier-risk/30 rounded-lg hover:bg-tier-risk/5 transition cursor-pointer shrink-0"
            :disabled="isLeaving"
          >
            <LogOut class="w-3.5 h-3.5" />
            {{ isLeaving ? 'กำลังออก...' : 'ออกจากกลุ่ม' }}
          </button>
        </div>

        <div class="flex items-center justify-between border-t border-border-subtle pt-3 text-xs">
          <div class="flex flex-col">
            <span class="text-caption text-ink-muted leading-none">รหัสเข้าร่วมกลุ่ม</span>
            <span class="text-sm font-brand font-black text-ink mt-1 flex items-center gap-2 select-all">
              {{ group?.inviteCode }}
              <button 
                @click="handleCopyInvite"
                class="p-1 hover:bg-slate-100 rounded text-ink-muted hover:text-ink cursor-pointer"
              >
                <Check v-if="copied" class="w-3.5 h-3.5 text-primary" />
                <Copy v-else class="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
          <div class="flex flex-col text-right">
            <span class="text-caption text-ink-muted leading-none">สมาชิกทั้งหมด</span>
            <span class="text-sm font-bold text-ink mt-1">{{ group?.membersCount }} / {{ group?.maxMembers }} คน</span>
          </div>
        </div>

        <p
          v-if="isSoloGroup"
          class="text-xs text-ink-muted border-t border-border-subtle pt-3 leading-relaxed"
        >
          ตอนนี้มีแค่คุณในกลุ่ม — แชร์รหัสเชิญ <span class="font-bold text-ink">{{ group?.inviteCode }}</span> ให้เพื่อนเข้าร่วมและเริ่มแข่งขันกัน
        </p>
      </div>

      <!-- Tab switchers -->
      <div class="tab-switch">
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

      <div class="space-y-5">
        <!-- Leaderboard -->
        <div v-show="currentTab === 'leaderboard'" class="w-full space-y-3">
          <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider mb-1">
            ตารางอันดับกลุ่ม (Leaderboard)
          </h3>
          <div 
            v-for="(member, index) in groupStore.leaderboard" 
            :key="member.id || member.displayName"
            class="surface-card-sm flex items-center justify-between transition-colors border-2 rounded-xl p-3"
            :class="member.displayName === currentUser.displayName ? 'border-primary/40 bg-duo-green-light/20' : 'border-border-subtle bg-surface-card'"
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
                    class="text-micro font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-full"
                  >
                    คุณ
                  </span>
                </span>
                <span class="text-caption text-ink-muted mt-1 leading-none">
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
                <span class="text-micro text-ink-muted mt-1 leading-none uppercase">คะแนน</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Activity Feed -->
        <div v-show="currentTab === 'feed'" class="w-full space-y-3">
          <h3 class="text-xs font-extrabold text-ink-muted uppercase tracking-wider mb-1">
            กิจกรรมล่าสุด (Activity Feed)
          </h3>

          <div
            v-if="!hasFeedEvents"
            class="surface-card p-6 border-2 border-dashed border-border-subtle rounded-xl text-center space-y-2"
          >
            <p class="text-sm font-bold text-ink">ยังไม่มีกิจกรรม</p>
            <p class="text-xs text-ink-muted leading-relaxed">
              กิจกรรมจะปรากฏเมื่อคุณหรือเพื่อนในวงเปลี่ยนคะแนนหรือปลดล็อกตราเกียรติยศ
            </p>
          </div>

          <div 
            v-for="e in groupStore.feedEvents" 
            :key="e.id"
            class="surface-card p-4 space-y-3 border-2 border-border-subtle rounded-xl bg-surface-card"
          >
            <!-- Header -->
            <div class="flex items-center gap-2">
              <img :src="e.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.displayName}`" class="w-6 h-6 rounded-full bg-slate-100" />
              <span class="text-xs font-bold text-ink">{{ e.displayName }}</span>
              <span class="text-micro text-ink-muted ml-auto">{{ formatTimeAgo(e.createdAt) }}</span>
            </div>

            <!-- Event content -->
            <p class="text-xs text-ink leading-relaxed pl-1 font-semibold">
              {{ formatEventText(e) }}
            </p>

            <!-- Reactions row -->
            <div class="flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-2.5">
              <button 
                v-for="(count, emoji) in e.reactions"
                :key="emoji"
                @click="handleReact(e.id, emoji)"
                class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-bg border border-border-subtle hover:bg-slate-100 transition text-caption font-bold text-ink cursor-pointer"
              >
                <span>{{ emoji }}</span>
                <span>{{ count }}</span>
              </button>

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

      <p v-if="groupError" class="text-xs font-semibold text-tier-risk text-center">{{ groupError }}</p>
    </div>

  </div>
</template>

<style scoped>
/* Scoped styles */
</style>

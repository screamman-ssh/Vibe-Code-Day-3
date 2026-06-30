<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Users, AlertTriangle, Trophy, Flame, Megaphone } from 'lucide-vue-next'
import { useGroupStore } from '../stores/group'
import { tierColor } from '../composables/useFormat.js'
import { api } from '../api'
import HexBadge from '../components/score/HexBadge.vue'

const { t } = useI18n()
const groupStore = useGroupStore()
const tab = ref('leaderboard')

const feedReactions = ref({})
const userReacted = ref({})

onMounted(async () => {
  await groupStore.fetchAll()
  groupStore.feed.forEach(event => {
    if (!feedReactions.value[event.id]) {
      const r = event.reactions || {}
      feedReactions.value[event.id] = {
        '👏': r['👏'] || 0,
        '🔥': r['🔥'] || 0,
        '❤️': r['❤️'] || 0,
      }
      userReacted.value[event.id] = { '👏': false, '🔥': false, '❤️': false }
    }
  })
})

function feedText(event) {
  const p = event.payload
  switch (event.eventType) {
    case 'score_changed':
      return t('feed.score_changed', { prev: p.previous_score, next: p.new_score })
    case 'badge_earned':
      return t('feed.badge_earned', { name: p.badge_name })
    case 'streak_milestone':
      return t('feed.streak_milestone', { days: p.streak_days })
    default:
      return event.eventType
  }
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function react(eventId, type) {
  if (!feedReactions.value[eventId]) return

  const alreadyReacted = userReacted.value[eventId][type]
  try {
    await api.reactToFeedEvent(eventId, type)
    if (alreadyReacted) {
      feedReactions.value[eventId][type]--
      userReacted.value[eventId][type] = false
    } else {
      feedReactions.value[eventId][type]++
      userReacted.value[eventId][type] = true
    }
  } catch (err) {
    console.error('Failed to react to feed event:', err)
  }
}

function getRankBadgeType(rank, hideRank) {
  if (hideRank) return 'orange'
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return 'blue'
}
</script>

<template>
  <div class="page-shell text-ink lg:max-w-4xl">
    <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-brand text-2xl font-bold tracking-tight text-ink text-balance">
          {{ t('circle.title') }}
        </h1>
        <p v-if="groupStore.group" class="meta-label mt-1 flex min-w-0 items-center gap-1.5">
          <Users class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span class="truncate">{{ groupStore.group.name }}</span>
        </p>
        <p v-else class="meta-label mt-1 flex items-center gap-1.5 text-tier-building">
          <AlertTriangle class="h-4 w-4 shrink-0" aria-hidden="true" />
          {{ t('circle.noGroup') }}
        </p>
      </div>

      <div v-if="groupStore.group" class="surface-soft flex items-center gap-3">
        <span class="tile-label">{{ t('circle.inviteCode') }}</span>
        <code class="text-sm font-semibold tracking-wide text-accent-emerald">{{ groupStore.group.inviteCode }}</code>
      </div>
    </header>

    <div class="tab-switch lg:hidden">
      <button
        type="button"
        class="tab-switch-btn"
        :class="tab === 'leaderboard' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
        @click="tab = 'leaderboard'"
      >
        {{ t('circle.leaderboard') }}
      </button>
      <button
        type="button"
        class="tab-switch-btn"
        :class="tab === 'feed' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
        @click="tab = 'feed'"
      >
        {{ t('circle.feed') }}
      </button>
    </div>

    <div v-if="groupStore.loading" class="text-center py-10 text-ink-muted font-medium">
      {{ t('common.loading') }}
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

      <section
        class="lg:col-span-7 space-y-4"
        :class="{ 'hidden lg:block': tab !== 'leaderboard' }"
      >
        <div class="flex items-center justify-between mb-2">
          <h2 class="section-title flex items-center gap-2">
            <Trophy class="h-4 w-4 text-tier-building" aria-hidden="true" />
            {{ t('circle.leaderboard') }}
          </h2>
          <span class="meta-label">{{ t('common.membersCount', { count: groupStore.leaderboard.length }) }}</span>
        </div>

        <ul class="space-y-3">
          <li
            v-for="member in groupStore.leaderboard"
            :key="member.displayName"
            class="surface-soft flex items-center gap-3.5"
          >
            <HexBadge
              :value="member.hideRank ? '—' : member.rank"
              :type="getRankBadgeType(member.rank, member.hideRank)"
              size="md"
            />

            <div class="min-w-0 flex-1">
              <p class="font-semibold text-ink leading-tight">{{ member.displayName }}</p>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  class="chip text-[11px] font-semibold"
                  :class="tierColor(member.tier)"
                >
                  {{ member.tierTh }} {{ member.score }}
                </span>
                <span
                  v-for="badge in member.badges"
                  :key="badge"
                  class="chip text-[11px] text-tier-building bg-amber-50 border-amber-100"
                >
                  {{ badge }}
                </span>
              </div>
            </div>

            <div class="text-right shrink-0">
              <span class="chip-negative inline-flex items-center gap-0.5 text-xs font-semibold px-2.5 py-1">
                <Flame class="h-3.5 w-3.5" aria-hidden="true" />
                {{ member.streakDays }}
              </span>
            </div>
          </li>
        </ul>
      </section>

      <section
        class="lg:col-span-5 space-y-4"
        :class="{ 'hidden lg:block': tab !== 'feed' }"
      >
        <div class="flex items-center justify-between mb-2">
          <h2 class="section-title">{{ t('circle.feedTitle') }}</h2>
        </div>

        <ul class="space-y-3">
          <li v-if="!groupStore.feed.length" class="surface-soft p-8 text-center text-sm text-ink-muted">
            <Megaphone class="mx-auto h-8 w-8 mb-2 text-ink-muted" aria-hidden="true" />
            {{ t('circle.emptyFeed') }}
          </li>
          <li
            v-for="event in groupStore.feed"
            :key="event.id"
            class="surface-soft"
          >
            <div class="flex items-start gap-3">
              <div class="icon-tile h-9 w-9 text-xs font-semibold text-accent-emerald uppercase">
                {{ event.displayName?.charAt(0) || 'U' }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm text-ink leading-snug">
                  <strong class="font-semibold">{{ event.displayName }}</strong>
                  <span class="text-ink-muted"> {{ feedText(event) }}</span>
                </p>
                <p class="mt-1 meta-label">
                  {{ formatTime(event.createdAt) }}
                </p>

                <div class="mt-3 flex items-center gap-1.5 border-t border-border-subtle pt-2.5">
                  <button
                    v-for="(count, emoji) in feedReactions[event.id]"
                    :key="emoji"
                    type="button"
                    class="nav-item inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer select-none"
                    :class="[
                      userReacted[event.id]?.[emoji]
                        ? 'chip-positive'
                        : 'bg-surface-bg text-ink-muted border-border-subtle hover:bg-surface-card'
                    ]"
                    @click="react(event.id, emoji)"
                  >
                    <span>{{ emoji }}</span>
                    <span>{{ count }}</span>
                  </button>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </section>

    </div>
  </div>
</template>

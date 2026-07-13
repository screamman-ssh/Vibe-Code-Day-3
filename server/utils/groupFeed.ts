export const SEED_USER_IDS = [
  'usr_nune',
  'usr_boss',
  'usr_peak',
  'usr_jane'
]

const SEED_FEED_IDS = [
  'feed_nune_badge',
  'feed_boss_score',
  'feed_peak_challenge'
]

const SEED_POST_IDS = [
  'post_nune_badge',
  'post_boss_text',
  'post_boss_score',
  'post_peak_challenge',
  'post_jane_text'
]

function seedPlaceholders(count: number) {
  return Array.from({ length: count }, () => '?').join(', ')
}

async function deleteSocialPostsByIds(db: any, postIds: string[]) {
  if (!postIds.length) return

  const postPh = seedPlaceholders(postIds.length)

  await db.prepare(`
    DELETE FROM reply_likes WHERE reply_id IN (
      SELECT id FROM social_replies WHERE post_id IN (${postPh})
    )
  `).bind(...postIds).run().catch(() => {})

  await db.prepare(`
    DELETE FROM social_replies WHERE post_id IN (${postPh})
  `).bind(...postIds).run().catch(() => {})

  await db.prepare(`
    DELETE FROM post_likes WHERE post_id IN (${postPh})
  `).bind(...postIds).run().catch(() => {})

  await db.prepare(`
    DELETE FROM social_posts WHERE id IN (${postPh})
  `).bind(...postIds).run().catch(() => {})
}

export async function purgeSeedUsers(db: any) {
  const userPh = seedPlaceholders(SEED_USER_IDS.length)
  const postPh = seedPlaceholders(SEED_POST_IDS.length)

  const remaining = await db.prepare(`
    SELECT id FROM users WHERE id IN (${userPh}) LIMIT 1
  `).bind(...SEED_USER_IDS).first()

  if (!remaining) return

  // Reposts by real users block deleting seed posts (repost_of_id FK).
  const { results: repostRows } = await db.prepare(`
    SELECT id FROM social_posts WHERE repost_of_id IN (${postPh})
  `).bind(...SEED_POST_IDS).all()

  const repostIds = (repostRows || []).map((row: any) => row.id).filter(Boolean)
  await deleteSocialPostsByIds(db, repostIds)

  await deleteSocialPostsByIds(db, [...SEED_POST_IDS])

  await db.prepare(`
    DELETE FROM social_posts WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run().catch(() => {})

  await db.prepare(`
    DELETE FROM feed_events
    WHERE user_id IN (${userPh})
       OR id IN (${seedPlaceholders(SEED_FEED_IDS.length)})
  `).bind(...SEED_USER_IDS, ...SEED_FEED_IDS).run()

  await db.prepare(`
    DELETE FROM group_members WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run()

  for (const seedId of SEED_USER_IDS) {
    const ownedGroups = await db.prepare(`
      SELECT id FROM groups WHERE owner_id = ?
    `).bind(seedId).all()

    for (const row of ownedGroups?.results || []) {
      const nextOwner = await db.prepare(`
        SELECT user_id as userId FROM group_members
        WHERE group_id = ? AND user_id NOT IN (${userPh})
        ORDER BY joined_at ASC LIMIT 1
      `).bind(row.id, ...SEED_USER_IDS).first()

      if (nextOwner?.userId) {
        await db.prepare(`
          UPDATE groups SET owner_id = ? WHERE id = ?
        `).bind(nextOwner.userId, row.id).run()
      } else {
        await db.prepare(`DELETE FROM feed_events WHERE group_id = ?`).bind(row.id).run()
        await db.prepare(`DELETE FROM group_members WHERE group_id = ?`).bind(row.id).run()
        await db.prepare(`DELETE FROM groups WHERE id = ?`).bind(row.id).run()
      }
    }
  }

  await db.prepare(`
    DELETE FROM challenge_participations WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run().catch(() => {})

  await db.prepare(`
    DELETE FROM debt_payments WHERE debt_id IN (
      SELECT id FROM debts WHERE user_id IN (${userPh})
    )
  `).bind(...SEED_USER_IDS).run().catch(() => {})

  await db.prepare(`
    DELETE FROM debts WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run().catch(() => {})

  await db.prepare(`
    DELETE FROM transactions WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run().catch(() => {})

  await db.prepare(`
    DELETE FROM budgets WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run().catch(() => {})

  await db.prepare(`
    DELETE FROM llm_usage_logs WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run().catch(() => {})

  await db.prepare(`
    DELETE FROM user_badges WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run()

  await db.prepare(`
    DELETE FROM score_snapshots WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run()

  await db.prepare(`
    DELETE FROM refresh_tokens WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run()

  await db.prepare(`
    DELETE FROM user_follows
    WHERE follower_id IN (${userPh}) OR following_id IN (${userPh})
  `).bind(...SEED_USER_IDS, ...SEED_USER_IDS).run()

  await db.prepare(`
    DELETE FROM chat_attachments WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run().catch(() => {})

  await db.prepare(`
    DELETE FROM chat_drafts WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run().catch(() => {})

  await db.prepare(`
    DELETE FROM chat_history WHERE user_id IN (${userPh})
  `).bind(...SEED_USER_IDS).run().catch(() => {})

  await db.prepare(`
    DELETE FROM users WHERE id IN (${userPh})
  `).bind(...SEED_USER_IDS).run()
}

export async function appendGroupFeedEvent(
  db: any,
  {
    userId,
    eventType,
    payload
  }: {
    userId: string
    eventType: string
    payload: Record<string, unknown>
  }
) {
  const membership = await db.prepare(`
    SELECT group_id as groupId FROM group_members WHERE user_id = ?
  `).bind(userId).first()

  if (!membership?.groupId) return null

  const eventId = `feed_${crypto.randomUUID().replace(/-/g, '')}`
  const payloadWithReactions = { ...payload, reactions: {} }

  await db.prepare(`
    INSERT INTO feed_events (id, group_id, user_id, event_type, payload, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    eventId,
    membership.groupId,
    userId,
    eventType,
    JSON.stringify(payloadWithReactions)
  ).run()

  return eventId
}

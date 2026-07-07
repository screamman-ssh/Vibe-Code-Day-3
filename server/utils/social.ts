export const SOCIAL_SEED_USERS = [
  { id: 'usr_nune', google_id: 'google_gid_nune', display_name: 'Nune', bio: 'กำลังสร้างวินัยการเงินใหม่ 🌱', subscription_tier: 'free', logging_streak_days: 12, score: 72, tier: 'Steady', tier_th: 'มั่นคง' },
  { id: 'usr_boss', google_id: 'google_gid_boss', display_name: 'Boss', bio: 'ออมเงิน ลดหนี้ สร้างอนาคต 💪', subscription_tier: 'premium', logging_streak_days: 8, score: 68, tier: 'Steady', tier_th: 'มั่นคง' },
  { id: 'usr_peak', google_id: 'google_gid_peak', display_name: 'Peak', bio: 'เริ่มต้นจัดการเงินส่วนตัว', subscription_tier: 'free', logging_streak_days: 3, score: 54, tier: 'Building', tier_th: 'กำลังสร้าง' },
  { id: 'usr_jane', google_id: 'google_gid_jane', display_name: 'Jane', bio: 'บันทึกทุกบาท รู้ทุกทาง ✨', subscription_tier: 'free', logging_streak_days: 1, score: 48, tier: 'Building', tier_th: 'กำลังสร้าง' }
]

export const SOCIAL_SEED_POSTS = [
  {
    id: 'post_nune_badge',
    user_id: 'usr_nune',
    post_type: 'badge_earned',
    content: null,
    payload: { badge_name: 'Budget Boss' },
    created_offset_hours: -26
  },
  {
    id: 'post_boss_text',
    user_id: 'usr_boss',
    post_type: 'text',
    content: 'เพิ่งตั้งงบหมวดอาหารใหม่ ลดลง 20% แล้วรู้สึกว่าคุมได้มากขึ้น!',
    payload: {},
    created_offset_hours: -8
  },
  {
    id: 'post_boss_score',
    user_id: 'usr_boss',
    post_type: 'score_changed',
    content: null,
    payload: { previous_score: 65, new_score: 68, tier: 'Steady' },
    created_offset_hours: -3
  },
  {
    id: 'post_peak_challenge',
    user_id: 'usr_peak',
    post_type: 'challenge_completed',
    content: null,
    payload: { challenge_name: 'บันทึกค่าใช้จ่ายครบ 5 ครั้ง' },
    created_offset_hours: -1
  },
  {
    id: 'post_jane_text',
    user_id: 'usr_jane',
    post_type: 'text',
    content: 'วันนี้บันทึกครบทุกรายการแล้ว รู้สึกดีมากที่เห็นภาพรวมชัดขึ้น 📊',
    payload: {},
    created_offset_hours: 0
  }
]

export const SOCIAL_POST_SELECT = `
  sp.id,
  sp.user_id as userId,
  u.display_name as displayName,
  u.avatar_url as avatarUrl,
  sp.post_type as postType,
  sp.content,
  sp.payload,
  sp.repost_of_id as repostOfId,
  sp.quote_text as quoteText,
  sp.created_at as createdAt,
  (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = sp.id) as likeCount,
  (SELECT COUNT(*) FROM social_replies sr WHERE sr.post_id = COALESCE(sp.repost_of_id, sp.id)) as replyCount,
  (SELECT COUNT(*) FROM social_posts sp2 WHERE sp2.repost_of_id = COALESCE(sp.repost_of_id, sp.id)) as repostCount,
  orig.id as origId,
  orig.user_id as origUserId,
  orig_u.display_name as origDisplayName,
  orig_u.avatar_url as origAvatarUrl,
  orig.post_type as origPostType,
  orig.content as origContent,
  orig.payload as origPayload,
  orig.created_at as origCreatedAt
`

export async function ensureSocialSeedData(db: any) {
  const userStatements = []
  const scoreStatements = []

  for (const u of SOCIAL_SEED_USERS) {
    userStatements.push(db.prepare(`
      INSERT OR IGNORE INTO users (id, google_id, display_name, bio, subscription_tier, logging_streak_days, onboarding_complete)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(u.id, u.google_id, u.display_name, u.bio, u.subscription_tier, u.logging_streak_days))

    const snapshotId = `snp_${crypto.randomUUID().replace(/-/g, '')}`
    scoreStatements.push(db.prepare(`
      INSERT OR IGNORE INTO score_snapshots (id, user_id, total_score, tier, tier_th, details)
      VALUES (?, ?, ?, ?, ?, '{}')
    `).bind(snapshotId, u.id, u.score, u.tier, u.tier_th))
  }

  const postStatements = SOCIAL_SEED_POSTS.map(p => {
    const timeStr = new Date(Date.now() + p.created_offset_hours * 60 * 60 * 1000).toISOString()
    return db.prepare(`
      INSERT OR IGNORE INTO social_posts (id, user_id, post_type, content, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(p.id, p.user_id, p.post_type, p.content, JSON.stringify(p.payload), timeStr)
  })

  await db.batch([...userStatements, ...scoreStatements, ...postStatements])
}

export function parsePostPayload(payload: string) {
  try {
    return JSON.parse(payload || '{}')
  } catch {
    return {}
  }
}

function formatEmbedPost(row: any) {
  if (!row?.origId) return null
  const payloadObj = parsePostPayload(row.origPayload)
  return {
    id: row.origId,
    userId: row.origUserId,
    displayName: row.origDisplayName,
    avatarUrl: row.origAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.origDisplayName}`,
    postType: row.origPostType,
    content: row.origContent,
    payload: payloadObj,
    createdAt: row.origCreatedAt
  }
}

export function formatSocialPost(row: any, currentUserId?: string, isLiked?: boolean, isReposted?: boolean) {
  const payloadObj = parsePostPayload(row.payload)
  const cleanPayload = { ...payloadObj }
  delete cleanPayload.reactions

  const liked = isLiked !== undefined
    ? isLiked
    : !!(row.isLiked)

  const reposted = isReposted !== undefined
    ? isReposted
    : !!(row.isReposted)

  const post: any = {
    id: row.id,
    userId: row.userId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.displayName}`,
    postType: row.postType,
    content: row.content,
    payload: cleanPayload,
    quoteText: row.quoteText || null,
    createdAt: row.createdAt,
    likeCount: row.likeCount || 0,
    replyCount: row.replyCount || 0,
    repostCount: row.repostCount || 0,
    isLiked: liked,
    isReposted: reposted,
    source: 'social'
  }

  if (row.repostOfId) {
    post.repostOf = formatEmbedPost({
      origId: row.origId,
      origUserId: row.origUserId,
      origDisplayName: row.origDisplayName,
      origAvatarUrl: row.origAvatarUrl,
      origPostType: row.origPostType,
      origContent: row.origContent,
      origPayload: row.origPayload,
      origCreatedAt: row.origCreatedAt
    })
  }

  return post
}

export function formatReply(row: any, currentUserId?: string) {
  return {
    id: row.id,
    postId: row.postId,
    parentReplyId: row.parentReplyId || null,
    userId: row.userId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.displayName}`,
    content: row.content,
    createdAt: row.createdAt,
    likeCount: row.likeCount || 0,
    isLiked: !!row.isLiked,
    isOwn: currentUserId ? row.userId === currentUserId : false
  }
}

export function buildReplyTree(flatReplies: any[]) {
  const map = new Map<string, any>()
  const roots: any[] = []

  for (const reply of flatReplies) {
    map.set(reply.id, { ...reply, children: [] })
  }

  for (const reply of flatReplies) {
    const node = map.get(reply.id)
    if (reply.parentReplyId && map.has(reply.parentReplyId)) {
      map.get(reply.parentReplyId).children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export async function fetchPostLikeStatus(db: any, postIds: string[], userId: string) {
  if (!postIds.length) return new Map<string, boolean>()
  const placeholders = postIds.map(() => '?').join(',')
  const { results } = await db.prepare(`
    SELECT post_id as postId FROM post_likes
    WHERE user_id = ? AND post_id IN (${placeholders})
  `).bind(userId, ...postIds).all()

  const liked = new Map<string, boolean>()
  for (const id of postIds) liked.set(id, false)
  for (const row of results || []) liked.set(row.postId, true)
  return liked
}

export async function fetchRepostStatus(db: any, rootPostIds: string[], userId: string) {
  if (!rootPostIds.length) return new Map<string, boolean>()
  const placeholders = rootPostIds.map(() => '?').join(',')
  const { results } = await db.prepare(`
    SELECT repost_of_id as rootPostId FROM social_posts
    WHERE user_id = ? AND repost_of_id IN (${placeholders})
      AND post_type IN ('repost', 'quote')
  `).bind(userId, ...rootPostIds).all()

  const reposted = new Map<string, boolean>()
  for (const id of rootPostIds) reposted.set(id, false)
  for (const row of results || []) reposted.set(row.rootPostId, true)
  return reposted
}

export async function fetchSocialPostById(db: any, postId: string, currentUserId: string) {
  const row = await db.prepare(`
    SELECT ${SOCIAL_POST_SELECT}
    FROM social_posts sp
    JOIN users u ON sp.user_id = u.id
    LEFT JOIN social_posts orig ON sp.repost_of_id = orig.id
    LEFT JOIN users orig_u ON orig.user_id = orig_u.id
    WHERE sp.id = ?
  `).bind(postId).first()

  if (!row) return null

  const rootId = row.repostOfId || row.id
  const likedMap = await fetchPostLikeStatus(db, [postId], currentUserId)
  const repostedMap = await fetchRepostStatus(db, [rootId], currentUserId)
  return formatSocialPost(
    row,
    currentUserId,
    likedMap.get(postId),
    repostedMap.get(rootId)
  )
}

export async function getUserScore(db: any, userId: string) {
  const scoreRow = await db.prepare(`
    SELECT total_score as score, tier, tier_th as tierTh
    FROM score_snapshots
    WHERE user_id = ?
    ORDER BY calculated_at DESC LIMIT 1
  `).bind(userId).first()

  return {
    score: scoreRow ? scoreRow.score : 50,
    tier: scoreRow ? scoreRow.tier : 'Building',
    tierTh: scoreRow ? scoreRow.tierTh : 'กำลังสร้าง'
  }
}

export function formatGroupFeedEvent(row: any) {
  const payloadRaw = typeof row.payload === 'string' ? row.payload : JSON.stringify(row.payload || {})
  const payloadObj = parsePostPayload(payloadRaw)
  const cleanPayload = { ...payloadObj }
  delete cleanPayload.reactions

  return {
    id: row.id,
    userId: row.userId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.displayName}`,
    postType: row.eventType,
    content: null,
    payload: cleanPayload,
    quoteText: null,
    createdAt: row.createdAt,
    likeCount: 0,
    replyCount: 0,
    repostCount: 0,
    isLiked: false,
    source: 'group',
    groupId: row.groupId,
    groupName: row.groupName
  }
}

export async function fetchGroupFeedPosts(db: any, userId: string) {
  const group = await db.prepare(`
    SELECT g.id, g.name
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
  `).bind(userId).first()

  if (!group) {
    return { posts: [], hasGroup: false, groupName: null }
  }

  const { results: rawFeed } = await db.prepare(`
    SELECT
      fe.id,
      fe.user_id as userId,
      u.display_name as displayName,
      u.avatar_url as avatarUrl,
      fe.event_type as eventType,
      fe.payload,
      fe.created_at as createdAt,
      fe.group_id as groupId
    FROM feed_events fe
    JOIN users u ON fe.user_id = u.id
    WHERE fe.group_id = ?
    ORDER BY fe.created_at DESC
    LIMIT 50
  `).bind(group.id).all()

  const posts = (rawFeed || []).map((row: any) =>
    formatGroupFeedEvent({ ...row, groupName: group.name })
  )

  return { posts, hasGroup: true, groupName: group.name }
}

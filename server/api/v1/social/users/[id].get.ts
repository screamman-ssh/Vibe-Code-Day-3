import { defineEventHandler, createError } from 'h3'
import { useDB } from '../../../../utils/db'
import { ensureSocialSeedData, formatSocialPost, SOCIAL_POST_SELECT, fetchPostLikeStatus, fetchRepostStatus, getUserScore } from '../../../../utils/social'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const targetId = event.context.params?.id
  if (!targetId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing user ID' })
  }

  const db = useDB(event)
  const userId = auth.userId

  try {
    await ensureSocialSeedData(db)

    const user = await db.prepare(`
      SELECT id, display_name as displayName, avatar_url as avatarUrl, bio, logging_streak_days as streakDays
      FROM users WHERE id = ?
    `).bind(targetId).first()

    if (!user) {
      throw createError({ statusCode: 404, statusMessage: 'User Not Found' })
    }

    const followersRow = await db.prepare(`
      SELECT COUNT(*) as c FROM user_follows WHERE following_id = ?
    `).bind(targetId).first()

    const followingRow = await db.prepare(`
      SELECT COUNT(*) as c FROM user_follows WHERE follower_id = ?
    `).bind(targetId).first()

    const isFollowingRow = await db.prepare(`
      SELECT 1 as v FROM user_follows WHERE follower_id = ? AND following_id = ?
    `).bind(userId, targetId).first()

    const score = await getUserScore(db, targetId)

    const { results: rawPosts } = await db.prepare(`
      SELECT ${SOCIAL_POST_SELECT}
      FROM social_posts sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN social_posts orig ON sp.repost_of_id = orig.id
      LEFT JOIN users orig_u ON orig.user_id = orig_u.id
      WHERE sp.user_id = ?
      ORDER BY sp.created_at DESC
      LIMIT 20
    `).bind(targetId).all()

    const postIds = (rawPosts || []).map((p: any) => p.id)
    const rootIds = [...new Set((rawPosts || []).map((p: any) => p.repostOfId || p.id))]
    const likedMap = await fetchPostLikeStatus(db, postIds, userId)
    const repostedMap = await fetchRepostStatus(db, rootIds, userId)

    return {
      profile: {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`,
        bio: user.bio || '',
        streakDays: user.streakDays,
        followersCount: followersRow ? followersRow.c : 0,
        followingCount: followingRow ? followingRow.c : 0,
        isFollowing: !!isFollowingRow,
        isSelf: userId === targetId,
        ...score
      },
      posts: (rawPosts || []).map((row: any) =>
        formatSocialPost(
          row,
          userId,
          likedMap.get(row.id),
          repostedMap.get(row.repostOfId || row.id)
        )
      )
    }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})

import { defineEventHandler, getQuery, createError } from 'h3'
import { useDB } from '../../../utils/db'
import {
  ensureSocialSeedData,
  formatSocialPost,
  SOCIAL_POST_SELECT,
  fetchPostLikeStatus,
  fetchRepostStatus,
  fetchGroupFeedPosts
} from '../../../utils/social'

const VALID_SCOPES = new Set(['public', 'following', 'group'])

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDB(event)
  const userId = auth.userId
  const scope = String(getQuery(event).scope || 'following')

  if (!VALID_SCOPES.has(scope)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: scope must be public, following, or group' })
  }

  try {
    await ensureSocialSeedData(db)

    const followingCountRow = await db.prepare(`
      SELECT COUNT(*) as c FROM user_follows WHERE follower_id = ?
    `).bind(userId).first()

    const followingCount = followingCountRow ? followingCountRow.c : 0

    if (scope === 'group') {
      const groupFeed = await fetchGroupFeedPosts(db, userId)
      return {
        scope,
        posts: groupFeed.posts,
        followingCount,
        hasGroup: groupFeed.hasGroup,
        groupName: groupFeed.groupName
      }
    }

    let whereClause = ''
    let binds: string[] = []

    if (scope === 'public') {
      whereClause = '1=1'
    } else {
      whereClause = `sp.user_id = ? OR sp.user_id IN (
        SELECT following_id FROM user_follows WHERE follower_id = ?
      )`
      binds = [userId, userId]
    }

    const { results: rawPosts } = await db.prepare(`
      SELECT ${SOCIAL_POST_SELECT}
      FROM social_posts sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN social_posts orig ON sp.repost_of_id = orig.id
      LEFT JOIN users orig_u ON orig.user_id = orig_u.id
      WHERE ${whereClause}
      ORDER BY sp.created_at DESC
      LIMIT 50
    `).bind(...binds).all()

    const postIds = (rawPosts || []).map((p: any) => p.id)
    const rootIds = [...new Set((rawPosts || []).map((p: any) => p.repostOfId || p.id))]
    const likedMap = await fetchPostLikeStatus(db, postIds, userId)
    const repostedMap = await fetchRepostStatus(db, rootIds, userId)

    const posts = (rawPosts || []).map((row: any) =>
      formatSocialPost(
        row,
        userId,
        likedMap.get(row.id),
        repostedMap.get(row.repostOfId || row.id)
      )
    )

    return {
      scope,
      posts,
      followingCount,
      hasGroup: null,
      groupName: null
    }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || `Database error: ${err.message}`
    })
  }
})

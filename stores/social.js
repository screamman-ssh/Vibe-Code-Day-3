import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { buildReplyTree } from '~/composables/useSocialHelpers'

export const useSocialStore = defineStore('social', () => {
  const feedPosts = ref([])
  const discoverUsers = ref([])
  const followingCount = ref(0)
  const feedFilter = ref('following')
  const hasGroup = ref(false)
  const groupName = ref(null)
  const replyCache = ref({})
  const api = useApi()

  function patchPost(postId, patch) {
    const post = feedPosts.value.find(p => p.id === postId)
    if (post) Object.assign(post, patch)
  }

  async function fetchFeed(scope = feedFilter.value) {
    try {
      feedFilter.value = scope
      const data = await api.get(`/api/v1/social/feed?scope=${encodeURIComponent(scope)}`)
      feedPosts.value = data.posts
      followingCount.value = data.followingCount
      if (scope === 'group') {
        hasGroup.value = !!data.hasGroup
        groupName.value = data.groupName || null
      }
    } catch (err) {
      console.error('Failed to fetch social feed:', err)
    }
  }

  async function fetchDiscover(search = '') {
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : ''
      const data = await api.get(`/api/v1/social/users${q}`)
      discoverUsers.value = data.users
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }

  async function fetchUserProfile(userId) {
    return api.get(`/api/v1/social/users/${userId}`)
  }

  async function createPost(content) {
    const post = await api.post('/api/v1/social/posts', { content })
    if (feedFilter.value !== 'group') {
      feedPosts.value.unshift(post)
    }
    return post
  }

  async function followUser(userId) {
    await api.post(`/api/v1/social/users/${userId}/follow`)
    followingCount.value += 1
    const user = discoverUsers.value.find(u => u.id === userId)
    if (user) user.isFollowing = true
  }

  async function unfollowUser(userId) {
    await api.delete(`/api/v1/social/users/${userId}/follow`)
    followingCount.value = Math.max(0, followingCount.value - 1)
    const user = discoverUsers.value.find(u => u.id === userId)
    if (user) user.isFollowing = false
  }

  async function toggleLike(postId, postRef = null) {
    const target = postRef || feedPosts.value.find(p => p.id === postId)
    if (!target) return null

    const prev = { likeCount: target.likeCount, isLiked: target.isLiked }
    target.isLiked = !target.isLiked
    target.likeCount = Math.max(0, target.likeCount + (target.isLiked ? 1 : -1))

    try {
      const res = await api.post(`/api/v1/social/posts/${postId}/like`)
      target.likeCount = res.likeCount
      target.isLiked = res.isLiked
      patchPost(postId, { likeCount: res.likeCount, isLiked: res.isLiked })
      return res
    } catch (err) {
      Object.assign(target, prev)
      throw err
    }
  }

  async function fetchReplies(threadRootId) {
    const data = await api.get(`/api/v1/social/posts/${threadRootId}/replies`)
    replyCache.value[threadRootId] = data.replies
    return data.replies
  }

  function getReplyTree(threadRootId) {
    const flat = replyCache.value[threadRootId] || []
    return buildReplyTree(flat)
  }

  async function createReply(threadRootId, content, parentReplyId = null, postRef = null) {
    const reply = await api.post(`/api/v1/social/posts/${threadRootId}/replies`, {
      content,
      parentReplyId
    })

    if (!replyCache.value[threadRootId]) {
      replyCache.value[threadRootId] = []
    }
    replyCache.value[threadRootId].push(reply)

    const bumped = new Set()
    const bump = (p) => {
      if (!p || bumped.has(p)) return
      if (p.id === threadRootId || p.repostOf?.id === threadRootId) {
        p.replyCount = (p.replyCount || 0) + 1
        bumped.add(p)
      }
    }
    feedPosts.value.forEach(bump)
    if (postRef) bump(postRef)

    return reply
  }

  async function deleteReply(threadRootId, replyId) {
    await api.delete(`/api/v1/social/replies/${replyId}`)
    replyCache.value[threadRootId] = await fetchReplies(threadRootId)
  }

  async function toggleReplyLike(threadRootId, replyId) {
    const cache = replyCache.value[threadRootId]
    const reply = cache?.find(r => r.id === replyId)
    if (!reply) return null

    const prev = { likeCount: reply.likeCount, isLiked: reply.isLiked }
    reply.isLiked = !reply.isLiked
    reply.likeCount = Math.max(0, reply.likeCount + (reply.isLiked ? 1 : -1))

    try {
      const res = await api.post(`/api/v1/social/replies/${replyId}/like`)
      reply.likeCount = res.likeCount
      reply.isLiked = res.isLiked
      return res
    } catch (err) {
      Object.assign(reply, prev)
      throw err
    }
  }

  async function repost(postId, mode, quoteText = null) {
    const target = feedPosts.value.find(p => (p.repostOf?.id || p.id) === postId)
    if (target?.isReposted) return null

    const body = { mode }
    if (mode === 'quote') body.quoteText = quoteText

    try {
      const post = await api.post(`/api/v1/social/posts/${postId}/repost`, body)
      feedPosts.value.unshift(post)

      feedPosts.value.forEach((p) => {
        const rootId = p.repostOf?.id || p.id
        if (rootId === postId || p.id === postId) {
          if (!p.isReposted) {
            p.repostCount = (p.repostCount || 0) + 1
          }
          p.isReposted = true
        }
      })

      return post
    } catch (err) {
      if (err?.statusCode === 409 || err?.status === 409) {
        feedPosts.value.forEach((p) => {
          const rootId = p.repostOf?.id || p.id
          if (rootId === postId || p.id === postId) {
            p.isReposted = true
          }
        })
      }
      throw err
    }
  }

  async function deletePost(postId) {
    await api.delete(`/api/v1/social/posts/${postId}`)
    feedPosts.value = feedPosts.value.filter(p => p.id !== postId)
    return { deleted: true }
  }

  function loadReportedPosts() {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem('socialReportedPosts') || '[]')
    } catch {
      return []
    }
  }

  const reportedPosts = ref(loadReportedPosts())

  function isPostReported(postId) {
    return reportedPosts.value.includes(postId)
  }

  function reportPost(postId) {
    if (isPostReported(postId)) return
    reportedPosts.value = [...reportedPosts.value, postId]
    if (typeof window !== 'undefined') {
      localStorage.setItem('socialReportedPosts', JSON.stringify(reportedPosts.value))
    }
  }

  function loadBookmarkedPosts() {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem('socialBookmarkedPosts') || '[]')
    } catch {
      return []
    }
  }

  const bookmarkedPosts = ref(loadBookmarkedPosts())

  function isPostBookmarked(postId) {
    return bookmarkedPosts.value.includes(postId)
  }

  function toggleBookmark(postId) {
    if (isPostBookmarked(postId)) {
      bookmarkedPosts.value = bookmarkedPosts.value.filter(id => id !== postId)
    } else {
      bookmarkedPosts.value = [...bookmarkedPosts.value, postId]
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('socialBookmarkedPosts', JSON.stringify(bookmarkedPosts.value))
    }
  }

  function reset() {
    feedPosts.value = []
    discoverUsers.value = []
    followingCount.value = 0
    feedFilter.value = 'following'
    hasGroup.value = false
    groupName.value = null
    replyCache.value = {}
  }

  return {
    feedPosts,
    discoverUsers,
    followingCount,
    feedFilter,
    hasGroup,
    groupName,
    replyCache,
    fetchFeed,
    fetchDiscover,
    fetchUserProfile,
    createPost,
    followUser,
    unfollowUser,
    toggleLike,
    fetchReplies,
    getReplyTree,
    createReply,
    deleteReply,
    toggleReplyLike,
    repost,
    deletePost,
    reportPost,
    isPostReported,
    reportedPosts,
    toggleBookmark,
    isPostBookmarked,
    bookmarkedPosts,
    reset
  }
})

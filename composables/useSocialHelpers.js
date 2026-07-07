export function buildReplyTree(flatReplies) {
  const map = new Map()
  const roots = []

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

export function getPostDisplayText(post) {
  if (!post) return ''
  switch (post.postType) {
    case 'score_changed':
      return `มีคะแนนเปลี่ยนเป็น ${post.payload.new_score} คะแนน (${post.payload.tier})`
    case 'badge_earned':
      return `ปลดล็อกตราเกียรติยศ "${post.payload.badge_name}" 🎉`
    case 'challenge_completed':
      return `ทำภารกิจสำเร็จ: ${post.payload.challenge_name} 👍`
    default:
      return post.content || post.quoteText || 'อัปเดตกิจกรรมประจำวัน'
  }
}

export function formatTimeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'เมื่อกี้'
  if (mins < 60) return `${mins} นาทีที่แล้ว`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ชม.ที่แล้ว`
  const days = Math.floor(hours / 24)
  return `${days} วันที่แล้ว`
}

/** Short feed timestamp like reference: 5ชม, 3ว, 28 มิ.ย. */
export function formatFeedTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'เมื่อกี้'
  if (mins < 60) return `${mins}น`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}ชม`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}ว`
  return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export function getUserHandle(displayName = '') {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]/gi, '')
  return slug || 'user'
}

export function getThreadRootId(post) {
  return post.repostOf?.id || post.id
}

-- One-shot purge of demo seed users (Nune, Boss, Peak, Jane)

-- Reposts of seed posts block FK delete on social_posts.repost_of_id
DELETE FROM reply_likes WHERE reply_id IN (
  SELECT id FROM social_replies WHERE post_id IN (
    SELECT id FROM social_posts WHERE repost_of_id IN (
      'post_nune_badge', 'post_boss_text', 'post_boss_score', 'post_peak_challenge', 'post_jane_text'
    )
  )
);

DELETE FROM social_replies WHERE post_id IN (
  SELECT id FROM social_posts WHERE repost_of_id IN (
    'post_nune_badge', 'post_boss_text', 'post_boss_score', 'post_peak_challenge', 'post_jane_text'
  )
);

DELETE FROM post_likes WHERE post_id IN (
  SELECT id FROM social_posts WHERE repost_of_id IN (
    'post_nune_badge', 'post_boss_text', 'post_boss_score', 'post_peak_challenge', 'post_jane_text'
  )
);

DELETE FROM social_posts WHERE repost_of_id IN (
  'post_nune_badge', 'post_boss_text', 'post_boss_score', 'post_peak_challenge', 'post_jane_text'
);

DELETE FROM reply_likes WHERE reply_id IN (
  SELECT id FROM social_replies WHERE post_id IN (
    'post_nune_badge', 'post_boss_text', 'post_boss_score', 'post_peak_challenge', 'post_jane_text'
  )
);

DELETE FROM social_replies WHERE post_id IN (
  'post_nune_badge', 'post_boss_text', 'post_boss_score', 'post_peak_challenge', 'post_jane_text'
);

DELETE FROM post_likes WHERE post_id IN (
  'post_nune_badge', 'post_boss_text', 'post_boss_score', 'post_peak_challenge', 'post_jane_text'
);

DELETE FROM social_posts WHERE user_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane')
  OR id IN ('post_nune_badge', 'post_boss_text', 'post_boss_score', 'post_peak_challenge', 'post_jane_text');

DELETE FROM feed_events WHERE user_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane')
  OR id IN ('feed_nune_badge', 'feed_boss_score', 'feed_peak_challenge');

DELETE FROM group_members WHERE user_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane');

DELETE FROM challenge_participations WHERE user_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane');

DELETE FROM debt_payments WHERE debt_id IN (
  SELECT id FROM debts WHERE user_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane')
);

DELETE FROM debts WHERE user_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane');

DELETE FROM transactions WHERE user_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane');

DELETE FROM budgets WHERE user_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane');

DELETE FROM llm_usage_logs WHERE user_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane');

DELETE FROM user_badges WHERE user_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane');

DELETE FROM score_snapshots WHERE user_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane');

DELETE FROM refresh_tokens WHERE user_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane');

DELETE FROM user_follows WHERE follower_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane')
  OR following_id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane');

DELETE FROM users WHERE id IN ('usr_nune', 'usr_boss', 'usr_peak', 'usr_jane');

-- Linkora initial schema (PostgreSQL)
-- Historical social network data model

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(30) NOT NULL UNIQUE,
  username_lower  VARCHAR(30) NOT NULL UNIQUE,
  display_name    VARCHAR(50) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  email_lower     VARCHAR(255) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  bio             VARCHAR(160) DEFAULT '',
  location        VARCHAR(100) DEFAULT '',
  website         VARCHAR(200) DEFAULT '',
  avatar_url      VARCHAR(500),
  header_url      VARCHAR(500),
  accent_color    VARCHAR(7) DEFAULT '#55ACEE',
  background_color VARCHAR(7) DEFAULT '#C0DEED',
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  is_protected    BOOLEAN NOT NULL DEFAULT FALSE,
  is_suspended    BOOLEAN NOT NULL DEFAULT FALSE,
  role            VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  tweets_count    INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  followers_count INTEGER NOT NULL DEFAULT 0,
  favorites_count INTEGER NOT NULL DEFAULT 0,
  lists_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at   TIMESTAMPTZ
);

CREATE INDEX idx_users_username_lower ON users(username_lower);
CREATE INDEX idx_users_email_lower ON users(email_lower);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Sessions (for connect-pg-simple)
CREATE TABLE session (
  sid    VARCHAR NOT NULL COLLATE "default",
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);
ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IDX_session_expire ON session(expire);

-- Tweets
CREATE TABLE tweets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text            VARCHAR(140) NOT NULL,
  reply_to_id     UUID REFERENCES tweets(id) ON DELETE SET NULL,
  reply_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_retweet      BOOLEAN NOT NULL DEFAULT FALSE,
  original_tweet_id UUID REFERENCES tweets(id) ON DELETE CASCADE,
  media_urls      TEXT[] DEFAULT '{}',
  media_types     TEXT[] DEFAULT '{}',
  favorites_count INTEGER NOT NULL DEFAULT 0,
  retweets_count  INTEGER NOT NULL DEFAULT 0,
  replies_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_tweets_user_id ON tweets(user_id);
CREATE INDEX idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX idx_tweets_reply_to ON tweets(reply_to_id);
CREATE INDEX idx_tweets_original ON tweets(original_tweet_id);
CREATE INDEX idx_tweets_user_created ON tweets(user_id, created_at DESC) WHERE deleted_at IS NULL;

-- Retweets (independent records)
CREATE TABLE retweets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tweet_id    UUID NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tweet_id)
);

CREATE INDEX idx_retweets_user ON retweets(user_id);
CREATE INDEX idx_retweets_tweet ON retweets(tweet_id);
CREATE INDEX idx_retweets_created ON retweets(created_at DESC);

-- Favorites
CREATE TABLE favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tweet_id    UUID NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tweet_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_tweet ON favorites(tweet_id);

-- Follows
CREATE TABLE follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- Follow requests (protected accounts)
CREATE TABLE follow_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, target_id)
);

-- Blocks
CREATE TABLE blocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

-- Mutes
CREATE TABLE mutes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(muter_id, muted_id),
  CHECK (muter_id <> muted_id)
);

CREATE INDEX idx_mutes_muter ON mutes(muter_id);

-- Notifications
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  type        VARCHAR(30) NOT NULL,
  tweet_id    UUID REFERENCES tweets(id) ON DELETE CASCADE,
  message     TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;

-- Conversations & Messages
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text             TEXT NOT NULL,
  media_url        VARCHAR(500),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

-- Hashtags
CREATE TABLE hashtags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag        VARCHAR(100) NOT NULL UNIQUE,
  tag_lower  VARCHAR(100) NOT NULL UNIQUE,
  use_count  INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tweet_hashtags (
  tweet_id   UUID NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (tweet_id, hashtag_id)
);

CREATE INDEX idx_hashtags_tag_lower ON hashtags(tag_lower);

-- Lists
CREATE TABLE lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(25) NOT NULL,
  description VARCHAR(100) DEFAULT '',
  is_private  BOOLEAN NOT NULL DEFAULT FALSE,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE list_members (
  list_id    UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (list_id, user_id)
);

-- Pinned tweets
CREATE TABLE pinned_tweets (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tweet_id   UUID NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reports
CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tweet_id    UUID REFERENCES tweets(id) ON DELETE SET NULL,
  category    VARCHAR(40) NOT NULL,
  details     TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Password resets / email verifications (architecture)
CREATE TABLE password_resets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_verifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User settings
CREATE TABLE user_settings (
  user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dm_from              VARCHAR(20) NOT NULL DEFAULT 'following' CHECK (dm_from IN ('everyone', 'following', 'none')),
  email_notifications  BOOLEAN NOT NULL DEFAULT TRUE,
  show_sensitive       BOOLEAN NOT NULL DEFAULT FALSE,
  language             VARCHAR(10) NOT NULL DEFAULT 'en',
  timezone             VARCHAR(50) DEFAULT 'UTC',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id  UUID,
  details    JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Trends cache (simple)
CREATE TABLE trends (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag        VARCHAR(100) NOT NULL,
  location   VARCHAR(100) DEFAULT 'worldwide',
  score      NUMERIC NOT NULL DEFAULT 0,
  rank       INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trends_location_rank ON trends(location, rank);

COMMIT;

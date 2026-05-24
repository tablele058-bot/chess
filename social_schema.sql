-- =====================================================================
-- SOCIAL CHESS — YugabyteDB (YSQL) Production Schema
-- Distributed hashing via SPLIT INTO 8 TABLETS for horizontal scaling.
-- =====================================================================

-- 1. PROFILES — mapped 1:1 to Clerk user.id
CREATE TABLE IF NOT EXISTS profiles (
    id          VARCHAR(255) PRIMARY KEY,
    username    VARCHAR(100) NOT NULL,
    avatar_url  TEXT,
    elo_rating  INT          NOT NULL DEFAULT 1200,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
) SPLIT INTO 8 TABLETS;

CREATE INDEX IF NOT EXISTS idx_profiles_elo
    ON profiles (elo_rating DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
    ON profiles (LOWER(username));

-- 2. FRIENDSHIPS — relational link with explicit status lifecycle
CREATE TABLE IF NOT EXISTS friendships (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     VARCHAR(255)  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id   VARCHAR(255)  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status      VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),

    CONSTRAINT uq_friendship_pair UNIQUE (user_id, friend_id),
    CONSTRAINT ck_no_self_friend CHECK (user_id <> friend_id)
) SPLIT INTO 8 TABLETS;

CREATE INDEX IF NOT EXISTS idx_friendships_user
    ON friendships (user_id HASH, status);

CREATE INDEX IF NOT EXISTS idx_friendships_friend
    ON friendships (friend_id HASH, status);

-- 3. CHALLENGES — live game invitations with time-control configuration
CREATE TABLE IF NOT EXISTS challenges (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id       VARCHAR(255)  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    challengee_id       VARCHAR(255)  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    time_control_type   VARCHAR(20)   NOT NULL DEFAULT 'BLITZ'
                        CHECK (time_control_type IN ('BULLET', 'BLITZ', 'RAPID', 'CUSTOM')),
    base_minutes        INT           NOT NULL DEFAULT 3,
    increment_seconds   INT           NOT NULL DEFAULT 2,
    status              VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),

    CONSTRAINT ck_no_self_challenge CHECK (challenger_id <> challengee_id)
) SPLIT INTO 8 TABLETS;

CREATE INDEX IF NOT EXISTS idx_challenges_challenger
    ON challenges (challenger_id HASH, status);

CREATE INDEX IF NOT EXISTS idx_challenges_challengee
    ON challenges (challengee_id HASH, status);

CREATE INDEX IF NOT EXISTS idx_challenges_status
    ON challenges (status, created_at DESC);

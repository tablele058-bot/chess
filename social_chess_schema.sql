-- =====================================================================
-- SOCIAL CHESS PLATFORM — YugabyteDB (YSQL) Schema Migration
-- Distributed hashing strategies for horizontal scalability.
-- =====================================================================

-- 1. PROFILES
-- Mapped 1:1 to Clerk user IDs. Uses HASH distribution on id (VARCHAR PK).
CREATE TABLE IF NOT EXISTS profiles (
    id          VARCHAR(255) PRIMARY KEY,
    username    VARCHAR(100) NOT NULL,
    avatar_url  TEXT,
    elo_rating  INT          NOT NULL DEFAULT 1200,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
) SPLIT INTO 8 TABLETS;

CREATE INDEX IF NOT EXISTS idx_profiles_elo
    ON profiles (elo_rating DESC);

-- Case-insensitive unique index for username lookups (ILIKE queries).
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
    ON profiles (LOWER(username));

-- 2. FRIENDSHIPS
-- Relational connections between profiles.
CREATE TABLE IF NOT EXISTS friendships (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id   VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status      VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'ACCEPTED')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),

    CONSTRAINT uq_friendship_pair UNIQUE (user_id, friend_id),
    CONSTRAINT ck_no_self_friend CHECK (user_id <> friend_id)
) SPLIT INTO 8 TABLETS;

-- Composite index for bidirectional friend lookups.
CREATE INDEX IF NOT EXISTS idx_friendships_user
    ON friendships (user_id HASH, status);

CREATE INDEX IF NOT EXISTS idx_friendships_friend
    ON friendships (friend_id HASH, status);

-- 3. LIVE_MATCHES
-- Permanent historical match record.
CREATE TABLE IF NOT EXISTS live_matches (
    id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    white_player_id       VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    black_player_id       VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    time_control_base     INT       NOT NULL,           -- milliseconds
    time_control_increment INT      NOT NULL DEFAULT 0, -- milliseconds
    board_theme           VARCHAR(50),
    current_fen           TEXT      NOT NULL,
    match_status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                          CHECK (match_status IN ('ACTIVE', 'RESIGNED', 'ABANDONED', 'COMPLETED')),
    winner_id             VARCHAR(255) REFERENCES profiles(id) ON DELETE SET NULL,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
) SPLIT INTO 8 TABLETS;

CREATE INDEX IF NOT EXISTS idx_live_matches_white
    ON live_matches (white_player_id HASH, match_status);

CREATE INDEX IF NOT EXISTS idx_live_matches_black
    ON live_matches (black_player_id HASH, match_status);

CREATE INDEX IF NOT EXISTS idx_live_matches_status
    ON live_matches (match_status, created_at DESC);

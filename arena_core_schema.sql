-- ============================================================================
-- SUJANA CHESS ARENA — Core Relational Schema for YugabyteDB (YSQL)
-- Distributed multi-node compatible: HASH sharding on PKs, explicit indexes
-- ============================================================================

-- ─── Profiles (maps 1:1 to Clerk user.id) ────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
    id          VARCHAR(255) PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL,
    avatar_url  TEXT         NOT NULL DEFAULT '',
    elo_rating  INT          NOT NULL DEFAULT 1200,
    games_played INT         NOT NULL DEFAULT 0,
    is_provisional BOOLEAN   NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique username index (prevents "Alice" / "alice" dupes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
    ON profiles (LOWER(username));

CREATE INDEX IF NOT EXISTS idx_profiles_elo
    ON profiles (elo_rating DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_provisional
    ON profiles (is_provisional, elo_rating DESC)
    WHERE is_provisional = TRUE;


-- ─── Friendships (bidirectional links) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id   VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status      VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'ACCEPTED', 'BLOCKED')),
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),

    -- Prevents duplicate friend pairs regardless of direction
    CONSTRAINT uq_friendship_pair
        UNIQUE (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)),
    CONSTRAINT ck_no_self_friend CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_sender
    ON friendships (sender_id HASH, status);

CREATE INDEX IF NOT EXISTS idx_friendships_receiver
    ON friendships (receiver_id HASH, status);


-- ─── Live Challenges (match invitations) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS live_challenges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id   VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    challengee_id   VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    time_base       INT          NOT NULL,
    time_increment  INT          NOT NULL,
    board_theme     VARCHAR(30)  NOT NULL DEFAULT 'green',
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_no_self_challenge CHECK (challenger_id <> challengee_id)
);

CREATE INDEX IF NOT EXISTS idx_live_challenges_challenger
    ON live_challenges (challenger_id HASH, status);

CREATE INDEX IF NOT EXISTS idx_live_challenges_challengee
    ON live_challenges (challengee_id HASH, status);

CREATE INDEX IF NOT EXISTS idx_live_challenges_status_age
    ON live_challenges (status, created_at DESC);


-- ─── Matches History (permanent PvP ledger) ──────────────────────────────
CREATE TABLE IF NOT EXISTS matches_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    white_player_id VARCHAR(255) NOT NULL REFERENCES profiles(id),
    black_player_id VARCHAR(255) NOT NULL REFERENCES profiles(id),
    current_fen     VARCHAR(255) NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/8/RNBQKBNR w KQkq - 0 1',
    pgn_moves       TEXT         NOT NULL DEFAULT '',
    white_elo_delta INT          NOT NULL DEFAULT 0,
    black_elo_delta INT          NOT NULL DEFAULT 0,
    time_base       INT          NOT NULL DEFAULT 600000,
    time_increment  INT          NOT NULL DEFAULT 2000,
    match_status    VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE'
                    CHECK (match_status IN ('ACTIVE','CHECKMATE','RESIGNED','ABANDONED','DRAW')),
    winner_id       VARCHAR(255) REFERENCES profiles(id),
    started_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_matches_history_white
    ON matches_history (white_player_id HASH, match_status);

CREATE INDEX IF NOT EXISTS idx_matches_history_black
    ON matches_history (black_player_id HASH, match_status);

CREATE INDEX IF NOT EXISTS idx_matches_history_status
    ON matches_history (match_status, completed_at DESC)
    WHERE match_status != 'ACTIVE';

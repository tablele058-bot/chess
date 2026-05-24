-- =====================================================================
-- MATCHMAKING & ELO — YugabyteDB (YSQL) Schema
-- Distributed hashing via SPLIT INTO 8 TABLETS.
-- =====================================================================

-- 1. PROFILES — competitive tracking columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS games_played  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_competitive
    ON profiles (is_provisional, elo_rating DESC);

-- 2. MATCHES — complete match metadata with rating fluctuations
CREATE TABLE IF NOT EXISTS matches (
    id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    white_player_id       VARCHAR(255)  NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    black_player_id       VARCHAR(255)  NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    time_control_base     INT           NOT NULL,             -- milliseconds
    time_control_increment INT          NOT NULL DEFAULT 0,
    white_elo_change      INT           NOT NULL DEFAULT 0,
    black_elo_change      INT           NOT NULL DEFAULT 0,
    match_status          VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                          CHECK (match_status IN ('ACTIVE', 'RESIGNED', 'ABANDONED', 'DRAW', 'CHECKMATE')),
    pgn_history           TEXT,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
    completed_at          TIMESTAMP WITH TIME ZONE
) SPLIT INTO 8 TABLETS;

CREATE INDEX IF NOT EXISTS idx_matches_white
    ON matches (white_player_id HASH, match_status);

CREATE INDEX IF NOT EXISTS idx_matches_black
    ON matches (black_player_id HASH, match_status);

CREATE INDEX IF NOT EXISTS idx_matches_status
    ON matches (match_status, created_at DESC);

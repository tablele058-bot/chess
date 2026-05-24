import { query, getPool } from './db';

let migrated = false;

async function canConnect(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    const client = await p.connect();
    client.release();
    return true;
  } catch {
    return false;
  }
}

export async function runMigrations(): Promise<void> {
  if (migrated) return;

  if (!(await canConnect())) {
    console.log('[Migrations] Database unreachable — skipping');
    return;
  }

  const statements: { name: string; sql: string }[] = [
    {
      name: 'profiles',
      sql: `CREATE TABLE IF NOT EXISTS profiles (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        avatar_url TEXT,
        elo_rating INT NOT NULL DEFAULT 1200,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
      )`,
    },
    {
      name: 'idx_profiles_elo',
      sql: `CREATE INDEX IF NOT EXISTS idx_profiles_elo ON profiles (elo_rating DESC)`,
    },
    {
      name: 'idx_profiles_username_lower',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON profiles (LOWER(username))`,
    },
    {
      name: 'friendships',
      sql: `CREATE TABLE IF NOT EXISTS friendships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        friend_id VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
        CONSTRAINT uq_friendship_pair UNIQUE (user_id, friend_id),
        CONSTRAINT ck_no_self_friend CHECK (user_id <> friend_id)
      )`,
    },
    {
      name: 'idx_friendships_user',
      sql: `CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships (user_id HASH, status)`,
    },
    {
      name: 'idx_friendships_friend',
      sql: `CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships (friend_id HASH, status)`,
    },
    {
      name: 'challenges',
      sql: `CREATE TABLE IF NOT EXISTS challenges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        challenger_id VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        challengee_id VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        time_control_type VARCHAR(20) NOT NULL DEFAULT 'BLITZ'
          CHECK (time_control_type IN ('BULLET', 'BLITZ', 'RAPID', 'CUSTOM')),
        base_minutes INT NOT NULL DEFAULT 3,
        increment_seconds INT NOT NULL DEFAULT 2,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
        CONSTRAINT ck_no_self_challenge CHECK (challenger_id <> challengee_id)
      )`,
    },
    {
      name: 'idx_challenges_challenger',
      sql: `CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges (challenger_id HASH, status)`,
    },
    {
      name: 'idx_challenges_challengee',
      sql: `CREATE INDEX IF NOT EXISTS idx_challenges_challengee ON challenges (challengee_id HASH, status)`,
    },
    {
      name: 'idx_challenges_status',
      sql: `CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges (status, created_at DESC)`,
    },
    {
      name: 'users',
      sql: `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        elo_rating INT DEFAULT 1200,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
      )`,
    },
    {
      name: 'idx_users_elo',
      sql: `CREATE INDEX IF NOT EXISTS idx_users_elo ON users (elo_rating DESC)`,
    },
    {
      name: 'games',
      sql: `CREATE TABLE IF NOT EXISTS games (
        id VARCHAR(255) PRIMARY KEY,
        white_player_id VARCHAR(255) REFERENCES users(id) ON DELETE RESTRICT,
        black_player_id VARCHAR(255) REFERENCES users(id) ON DELETE RESTRICT,
        is_bot_match BOOLEAN DEFAULT FALSE,
        bot_elo_setting INT,
        match_status VARCHAR(50) DEFAULT 'IN_PROGRESS',
        result VARCHAR(50),
        opponent VARCHAR(255),
        started_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
        ended_at TIMESTAMP WITH TIME ZONE
      )`,
    },
    {
      name: 'idx_games_white_player',
      sql: `CREATE INDEX IF NOT EXISTS idx_games_white_player ON games (white_player_id, started_at DESC)`,
    },
    {
      name: 'idx_games_black_player',
      sql: `CREATE INDEX IF NOT EXISTS idx_games_black_player ON games (black_player_id, started_at DESC)`,
    },
    {
      name: 'move_ledger',
      sql: `CREATE TABLE IF NOT EXISTS move_ledger (
        game_id VARCHAR(255) REFERENCES games(id) ON DELETE CASCADE,
        move_number INT NOT NULL,
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        player_id VARCHAR(255),
        move_notation VARCHAR(10) NOT NULL,
        resulting_fen TEXT NOT NULL,
        ms_taken INT,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
        PRIMARY KEY (game_id HASH, move_number ASC)
      )`,
    },
    {
      name: 'idx_move_ledger_game',
      sql: `CREATE INDEX IF NOT EXISTS idx_move_ledger_game ON move_ledger (game_id HASH, move_number ASC)`,
    },
    {
      name: 'profiles_competitive_columns',
      sql: `ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS games_played INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT TRUE`,
    },
    {
      name: 'idx_profiles_competitive',
      sql: `CREATE INDEX IF NOT EXISTS idx_profiles_competitive ON profiles (is_provisional, elo_rating DESC)`,
    },
    {
      name: 'matches',
      sql: `CREATE TABLE IF NOT EXISTS matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        white_player_id VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
        black_player_id VARCHAR(255) NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
        time_control_base INT NOT NULL,
        time_control_increment INT NOT NULL DEFAULT 0,
        white_elo_change INT NOT NULL DEFAULT 0,
        black_elo_change INT NOT NULL DEFAULT 0,
        match_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
          CHECK (match_status IN ('ACTIVE', 'RESIGNED', 'ABANDONED', 'DRAW', 'CHECKMATE')),
        pgn_history TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
        completed_at TIMESTAMP WITH TIME ZONE
      )`,
    },
    {
      name: 'idx_matches_white',
      sql: `CREATE INDEX IF NOT EXISTS idx_matches_white ON matches (white_player_id HASH, match_status)`,
    },
    {
      name: 'idx_matches_black',
      sql: `CREATE INDEX IF NOT EXISTS idx_matches_black ON matches (black_player_id HASH, match_status)`,
    },
    {
      name: 'idx_matches_status',
      sql: `CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (match_status, created_at DESC)`,
    },
    {
      name: 'matches_winner_id',
      sql: `ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_id VARCHAR(255) REFERENCES profiles(id)`,
    },
    {
      name: 'matches_current_fen',
      sql: `ALTER TABLE matches ADD COLUMN IF NOT EXISTS current_fen VARCHAR(255) DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'`,
    },
    {
      name: 'matches_clock_columns',
      sql: `ALTER TABLE matches ADD COLUMN IF NOT EXISTS white_clock_ms BIGINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS black_clock_ms BIGINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS last_move_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS draw_offered_by VARCHAR(255)`,
    },
    {
      name: 'match_moves',
      sql: `CREATE TABLE IF NOT EXISTS match_moves (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        move_number INT NOT NULL,
        player_id VARCHAR(255) NOT NULL,
        move_san VARCHAR(10) NOT NULL,
        move_uci VARCHAR(10) NOT NULL,
        resulting_fen VARCHAR(255) NOT NULL,
        clock_ms BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
        CONSTRAINT uq_match_move_number UNIQUE (match_id, move_number)
      )`,
    },
    {
      name: 'idx_match_moves_match',
      sql: `CREATE INDEX IF NOT EXISTS idx_match_moves_match ON match_moves (match_id HASH, move_number ASC)`,
    },
  ];

  for (const stmt of statements) {
    try {
      await query(stmt.sql);
    } catch (err) {
      console.warn(`[Migrations] Skipped "${stmt.name}":`, (err as Error)?.message || err);
    }
  }

  migrated = true;
  console.log('[Migrations] Schema migration complete');
}

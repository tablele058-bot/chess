import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';

async function safeQuery(sql: string, params: unknown[]) {
  try {
    return await query(sql, params);
  } catch {
    return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
  }
}

async function getProfileRow(userId: string) {
  try {
    const r = await query(
      `SELECT id, username, avatar_url, elo_rating, games_played, is_provisional, created_at FROM profiles WHERE id = $1`,
      [userId]
    );
    return r.rows[0] || null;
  } catch {
    try {
      const r = await query(
        `SELECT id, username, avatar_url, elo_rating, created_at FROM profiles WHERE id = $1`,
        [userId]
      );
      return r.rows[0] || null;
    } catch {
      return null;
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    await runMigrations();

    const userId = request.nextUrl.searchParams.get('userId') || '';
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const [userResult, profileResult, gamesResult, matchesResult] = await Promise.all([
      safeQuery(
        `SELECT id, username, email, elo_rating, created_at FROM users WHERE id = $1`,
        [userId]
      ),
      getProfileRow(userId),
      safeQuery(
        `SELECT id, opponent, result, started_at AS played_at, is_bot_match AS is_bot
         FROM games WHERE white_player_id = $1
         UNION ALL
         SELECT id, opponent, result, started_at AS played_at, is_bot_match AS is_bot
         FROM games WHERE black_player_id = $1
         ORDER BY started_at DESC LIMIT 50`,
        [userId, userId]
      ),
      safeQuery(
        `SELECT m.id::text,
                CASE WHEN m.white_player_id = $1 THEN p2.username ELSE p1.username END AS opponent,
                CASE
                  WHEN m.winner_id = $1 THEN 'Won'
                  WHEN m.winner_id IS NOT NULL AND m.winner_id != $1 THEN 'Lost'
                  WHEN m.match_status = 'DRAW' THEN 'Draw'
                  ELSE m.match_status
                END AS result,
                m.completed_at AS played_at,
                FALSE AS is_bot
         FROM matches m
         LEFT JOIN profiles p1 ON p1.id = m.white_player_id
         LEFT JOIN profiles p2 ON p2.id = m.black_player_id
         WHERE (m.white_player_id = $1 OR m.black_player_id = $1)
           AND m.match_status != 'ACTIVE'
         ORDER BY m.completed_at DESC LIMIT 50`,
        [userId]
      ),
    ]);

    const u = userResult.rows[0] || null;
    const games = [...(gamesResult.rows || []), ...(matchesResult.rows || [])]
      .sort((a: any, b: any) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
      .slice(0, 50)
      .map((g: any) => ({
        id: g.id,
        opponent: g.opponent || 'Unknown',
        result: g.result || 'Finished',
        playedAt: g.played_at || new Date().toISOString(),
        isBot: !!g.is_bot,
      }));
    const stats = {
      wins: games.filter((g: any) => g.result === 'Won').length,
      losses: games.filter((g: any) => g.result === 'Lost').length,
      draws: games.filter((g: any) => g.result === 'Draw').length,
      total: games.length,
    };

    return NextResponse.json({
      profile: {
        id: userId,
        username: profileResult?.username || u?.username || `user_${userId.slice(-6)}`,
        email: u?.email || '',
        avatar_url: profileResult?.avatar_url || null,
        elo: profileResult?.elo_rating ?? u?.elo_rating ?? 1200,
        gamesPlayed: profileResult?.games_played ?? games.length,
        isProvisional: profileResult?.is_provisional ?? games.length <= 15,
        createdAt: profileResult?.created_at || u?.created_at || new Date().toISOString(),
      },
      games,
      stats,
    });
  } catch (err) {
    console.error('[API users/profile]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

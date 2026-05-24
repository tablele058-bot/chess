import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || '';
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    await query(
      `UPDATE challenges
       SET status = 'EXPIRED'
       WHERE status = 'PENDING'
         AND (challenger_id = $1 OR challengee_id = $1)
         AND created_at < NOW() - INTERVAL '5 minutes'`,
      [userId],
    );

    const [incoming, outgoingAccepted] = await Promise.all([
      query(
        `SELECT c.id, c.challenger_id, c.challengee_id,
                c.time_control_type, c.base_minutes, c.increment_seconds,
                c.status, c.created_at,
                p.username AS challenger_username, p.elo_rating AS challenger_elo
         FROM challenges c
         JOIN profiles p ON p.id = c.challenger_id
         WHERE c.challengee_id = $1 AND c.status = 'PENDING'
         ORDER BY c.created_at DESC
         LIMIT 10`,
        [userId],
      ),
      query(
        `SELECT c.id, c.challenger_id, c.challengee_id,
                c.time_control_type, c.base_minutes, c.increment_seconds,
                c.status, c.created_at,
                p.username AS challengee_username, p.elo_rating AS challengee_elo,
                m.id AS match_id
         FROM challenges c
         JOIN profiles p ON p.id = c.challengee_id
         JOIN matches m ON (
           (m.white_player_id = c.challenger_id AND m.black_player_id = c.challengee_id)
           OR (m.white_player_id = c.challengee_id AND m.black_player_id = c.challenger_id)
         )
         WHERE c.challenger_id = $1 AND c.status = 'ACCEPTED'
           AND c.created_at > NOW() - INTERVAL '1 minute'
           AND m.match_status = 'ACTIVE'
         ORDER BY c.created_at DESC
         LIMIT 10`,
        [userId],
      ),
    ]);

    return NextResponse.json({
      challenges: incoming.rows,
      accepted: outgoingAccepted.rows,
    });
  } catch (err) {
    console.error('[API challenges/pending]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

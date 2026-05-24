import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';

export async function POST(request: NextRequest) {
  try {
    await runMigrations();

    const { challengeId, action, userId } = await request.json();

    if (!challengeId || !action || !userId) {
      return NextResponse.json({ error: 'Missing challengeId, action, or userId' }, { status: 400 });
    }

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json({ error: 'action must be accept or decline' }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const challenge = await client.query(
        `SELECT * FROM challenges WHERE id = $1 AND status = 'PENDING'`,
        [challengeId],
      );

      if (challenge.rows.length === 0) {
        throw new Error('NOT_FOUND');
      }

      const c = challenge.rows[0];

      if (c.challengee_id !== userId) {
        throw new Error('FORBIDDEN');
      }

      if (action === 'decline') {
        await client.query(
          `UPDATE challenges SET status = 'DECLINED' WHERE id = $1`,
          [challengeId],
        );
        return { success: true, action: 'declined' };
      }

      await client.query(
        `UPDATE challenges SET status = 'ACCEPTED' WHERE id = $1`,
        [challengeId],
      );

      const matchId = crypto.randomUUID();
      const baseSec = (c.base_minutes || 3) * 60;
      const incSec = c.increment_seconds || 2;

      await client.query(
        `INSERT INTO matches
           (id, white_player_id, black_player_id, match_status,
            time_control_base, time_control_increment,
            current_fen, white_clock_ms, black_clock_ms)
         VALUES ($1, $2, $3, 'ACTIVE',
                 $4, $5,
                 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                 $6, $6)`,
        [matchId, c.challenger_id, c.challengee_id, baseSec, incSec, baseSec * 1000],
      );

      const arenaUrl = `/arena/live/${matchId}`;

      return {
        success: true,
        action: 'accepted',
        matchId,
        arenaUrl,
        whitePlayerId: c.challenger_id,
        blackPlayerId: c.challengee_id,
        timeBase: c.base_minutes,
        timeIncrement: c.increment_seconds,
        boardTheme: 'green',
      };
    });

    if (!result) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    if ((err as Error).message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    if ((err as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Not your challenge to respond to' }, { status: 403 });
    }
    console.error('[API challenges/respond]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';

interface EloCalculatorBody {
  whitePlayerId: string;
  blackPlayerId: string;
  winnerId: string | null;
  timeBase: number;
  timeIncrement: number;
  pgnMoves: string;
}

interface ProfileRow {
  id: string;
  elo_rating: number;
  games_played: number;
  is_provisional: boolean;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function kFactor(gamesPlayed: number): number {
  return gamesPlayed <= 15 ? 40 : 20;
}

export async function POST(request: NextRequest) {
  try {
    const body: EloCalculatorBody = await request.json();
    const { whitePlayerId, blackPlayerId, winnerId, timeBase, timeIncrement, pgnMoves } = body;

    if (!whitePlayerId || !blackPlayerId) {
      return NextResponse.json({ error: 'Missing player IDs' }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const players = await client.query(
        `SELECT id, elo_rating, games_played, is_provisional
         FROM profiles
         WHERE id IN ($1, $2)`,
        [whitePlayerId, blackPlayerId],
      );

      if (players.rows.length < 2) {
        throw new Error('PLAYERS_NOT_FOUND');
      }

      const white = players.rows[0] as ProfileRow;
      const black = players.rows[1] as ProfileRow;

      let whiteOutcome: number;
      if (!winnerId) {
        whiteOutcome = 0.5;
      } else if (winnerId === whitePlayerId) {
        whiteOutcome = 1;
      } else {
        whiteOutcome = 0;
      }

      const eWhite = expectedScore(white.elo_rating, black.elo_rating);
      const eBlack = expectedScore(black.elo_rating, white.elo_rating);
      const kWhite = kFactor(white.games_played);
      const kBlack = kFactor(black.games_played);

      const whiteDelta = Math.round(kWhite * (whiteOutcome - eWhite));
      const blackDelta = Math.round(kBlack * (1 - whiteOutcome - eBlack));

      const whiteNewElo = Math.max(100, white.elo_rating + whiteDelta);
      const blackNewElo = Math.max(100, black.elo_rating + blackDelta);

      const whiteNewGames = white.games_played + 1;
      const blackNewGames = black.games_played + 1;

      await client.query(
        `UPDATE profiles
         SET elo_rating = $1, games_played = $2,
             is_provisional = $2 <= 15
         WHERE id = $3`,
        [whiteNewElo, whiteNewGames, whitePlayerId],
      );

      await client.query(
        `UPDATE profiles
         SET elo_rating = $1, games_played = $2,
             is_provisional = $2 <= 15
         WHERE id = $3`,
        [blackNewElo, blackNewGames, blackPlayerId],
      );

      const matchStatus = !winnerId ? 'DRAW' : 'CHECKMATE';

      const match = await client.query(
        `INSERT INTO matches
           (white_player_id, black_player_id, white_elo_change, black_elo_change,
            match_status, winner_id, pgn_history, time_control_base, time_control_increment, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING id::text`,
        [whitePlayerId, blackPlayerId, whiteDelta, blackDelta,
         matchStatus, winnerId, pgnMoves, timeBase, timeIncrement],
      );

      return {
        matchId: match.rows[0].id,
        whiteEloDelta: whiteDelta,
        blackEloDelta: blackDelta,
        whiteEloAfter: whiteNewElo,
        blackEloAfter: blackNewElo,
      };
    });

    if (!result) {
      return NextResponse.json({ error: 'Transaction failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if ((err as Error).message === 'PLAYERS_NOT_FOUND') {
      return NextResponse.json({ error: 'One or both players not found' }, { status: 404 });
    }
    console.error('[API game/elo-calculator]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

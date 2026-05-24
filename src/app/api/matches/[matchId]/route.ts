import { NextRequest, NextResponse } from 'next/server';
import { Chess } from 'chess.js';
import { query, withTransaction } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';

interface MatchRow {
  id: string;
  white_player_id: string;
  black_player_id: string;
  time_control_base: number;
  time_control_increment: number;
  white_elo_change: number;
  black_elo_change: number;
  match_status: string;
  pgn_history: string | null;
  current_fen: string | null;
  white_clock_ms: number;
  black_clock_ms: number;
  last_move_at: string | null;
  draw_offered_by: string | null;
  winner_id: string | null;
  created_at: string;
  completed_at: string | null;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function kFactor(gamesPlayed: number): number {
  return gamesPlayed <= 15 ? 40 : 20;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
): Promise<NextResponse> {
  const { matchId } = await params;
  if (!matchId) {
    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });
  }

  await runMigrations();

  try {
    const matchRes = await query(
      `SELECT m.*,
              w.username AS white_username, w.elo_rating AS white_elo,
              b.username AS black_username, b.elo_rating AS black_elo
       FROM matches m
       LEFT JOIN profiles w ON w.id = m.white_player_id
       LEFT JOIN profiles b ON b.id = m.black_player_id
       WHERE m.id = $1`,
      [matchId],
    );

    if (matchRes.rows.length === 0) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const match = matchRes.rows[0] as MatchRow & { white_username: string; white_elo: number; black_username: string; black_elo: number };

    const movesRes = await query(
      `SELECT move_number, player_id, move_san, move_uci, resulting_fen, clock_ms
       FROM match_moves
       WHERE match_id = $1
       ORDER BY move_number ASC`,
      [matchId],
    );

    const moveHistory = movesRes.rows.map((r) => ({
      moveNumber: r.move_number,
      playerId: r.player_id,
      san: r.move_san,
      uci: r.move_uci,
      fen: r.resulting_fen,
    }));

    return NextResponse.json({
      match: {
        id: match.id,
        whitePlayerId: match.white_player_id,
        blackPlayerId: match.black_player_id,
        whiteUsername: match.white_username,
        blackUsername: match.black_username,
        whiteElo: match.white_elo,
        blackElo: match.black_elo,
        timeControlBase: match.time_control_base,
        timeControlIncrement: match.time_control_increment,
        status: match.match_status,
        currentFen: match.current_fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        whiteClockMs: match.white_clock_ms,
        blackClockMs: match.black_clock_ms,
        lastMoveAt: match.last_move_at,
        drawOfferedBy: match.draw_offered_by,
        winnerId: match.winner_id,
        whiteEloChange: match.white_elo_change,
        blackEloChange: match.black_elo_change,
        createdAt: match.created_at,
        completedAt: match.completed_at,
        moveHistory,
      },
    });
  } catch (err) {
    console.error('[API matches/[matchId] GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
): Promise<NextResponse> {
  const { matchId } = await params;
  if (!matchId) {
    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });
  }

  await runMigrations();

  try {
    const body = await request.json();
    const { userId, from, to, promotion } = body;

    if (!userId || !from || !to) {
      return NextResponse.json({ error: 'Missing userId, from, or to' }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const matchRes = await client.query(
        `SELECT * FROM matches WHERE id = $1 FOR UPDATE`,
        [matchId],
      );

      if (matchRes.rows.length === 0) throw new Error('NOT_FOUND');

      const match = matchRes.rows[0] as MatchRow;

      if (match.match_status !== 'ACTIVE') throw new Error('GAME_OVER');

      const fen = match.current_fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const game = new Chess(fen);

      const expectedTurn = match.white_player_id === userId ? 'w' : 'b';
      if (game.turn() !== expectedTurn) throw new Error('NOT_YOUR_TURN');

      const move = game.move({ from, to, promotion });
      if (!move) throw new Error('INVALID_MOVE');

      const clockMs = body.clockMs != null ? Math.max(0, body.clockMs) : 100;
      const isWhite = match.white_player_id === userId;
      const incMs = (match.time_control_increment || 0) * 1000;
      const newWhiteClock = isWhite
        ? Math.max(0, (match.white_clock_ms || 0) - clockMs + incMs)
        : match.white_clock_ms;
      const newBlackClock = isWhite
        ? match.black_clock_ms
        : Math.max(0, (match.black_clock_ms || 0) - clockMs + incMs);

      const moveNumber = (match.pgn_history ? match.pgn_history.split(' ').length : 0) + 1;

      await client.query(
        `INSERT INTO match_moves
           (match_id, move_number, player_id, move_san, move_uci, resulting_fen, clock_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [matchId, moveNumber, userId, move.san, `${from}${to}${promotion || ''}`, game.fen(), clockMs],
      );

      const pgnHistory = (match.pgn_history ? match.pgn_history + ' ' : '') + move.san;

      await client.query(
        `UPDATE matches
         SET current_fen = $1, pgn_history = $2, last_move_at = clock_timestamp(),
             white_clock_ms = $3, black_clock_ms = $4
         WHERE id = $5`,
        [game.fen(), pgnHistory, newWhiteClock, newBlackClock, matchId],
      );

      const isCheckmate = game.isCheckmate();
      const isDraw = game.isDraw();

      if (isCheckmate || isDraw) {
        const finalStatus = isCheckmate ? 'CHECKMATE' : 'DRAW';
        const winnerId = isCheckmate ? userId : null;

        const whiteRes = await client.query(
          `SELECT id, elo_rating, games_played FROM profiles WHERE id = $1`,
          [match.white_player_id],
        );
        const blackRes = await client.query(
          `SELECT id, elo_rating, games_played FROM profiles WHERE id = $1`,
          [match.black_player_id],
        );

        if (whiteRes.rows.length > 0 && blackRes.rows.length > 0) {
          const w = whiteRes.rows[0] as { id: string; elo_rating: number; games_played: number };
          const b = blackRes.rows[0] as { id: string; elo_rating: number; games_played: number };

          let whiteOutcome: number;
          if (!winnerId) {
            whiteOutcome = 0.5;
          } else if (winnerId === match.white_player_id) {
            whiteOutcome = 1;
          } else {
            whiteOutcome = 0;
          }

          const eWhite = expectedScore(w.elo_rating, b.elo_rating);
          const eBlack = expectedScore(b.elo_rating, w.elo_rating);
          const kW = kFactor(w.games_played);
          const kB = kFactor(b.games_played);

          const wDelta = Math.round(kW * (whiteOutcome - eWhite));
          const bDelta = Math.round(kB * (1 - whiteOutcome - eBlack));

          const wNewElo = Math.max(100, w.elo_rating + wDelta);
          const bNewElo = Math.max(100, b.elo_rating + bDelta);

          await client.query(
            `UPDATE profiles SET elo_rating = $1, games_played = games_played + 1,
             is_provisional = (games_played + 1) <= 15 WHERE id = $2`,
            [wNewElo, match.white_player_id],
          );
          await client.query(
            `UPDATE profiles SET elo_rating = $1, games_played = games_played + 1,
             is_provisional = (games_played + 1) <= 15 WHERE id = $2`,
            [bNewElo, match.black_player_id],
          );

          await client.query(
            `UPDATE matches
             SET match_status = $1, winner_id = $2,
                 white_elo_change = $3, black_elo_change = $4,
                 completed_at = clock_timestamp()
             WHERE id = $5`,
            [finalStatus, winnerId, wDelta, bDelta, matchId],
          );

          return {
            success: true,
            move: { from, to, san: move.san, fen: game.fen() },
            gameOver: true,
            status: finalStatus,
            winnerId,
            whiteEloChange: wDelta,
            blackEloChange: bDelta,
            whiteEloAfter: wNewElo,
            blackEloAfter: bNewElo,
            whiteClockMs: newWhiteClock,
            blackClockMs: newBlackClock,
          };
        }
      }

      await client.query(
        `UPDATE matches SET match_status = $1 WHERE id = $2`,
        [isDraw && !isCheckmate ? 'DRAW' : 'ACTIVE', matchId],
      );

      return {
        success: true,
        move: { from, to, san: move.san, fen: game.fen() },
        gameOver: isCheckmate || isDraw,
        status: isCheckmate ? 'CHECKMATE' : isDraw ? 'DRAW' : 'ACTIVE',
        winnerId: isCheckmate ? userId : null,
        whiteClockMs: newWhiteClock,
        blackClockMs: newBlackClock,
      };
    });

    if (!result) {
      return NextResponse.json({ error: 'Transaction failed' }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (msg === 'GAME_OVER') return NextResponse.json({ error: 'Game is already over' }, { status: 400 });
    if (msg === 'NOT_YOUR_TURN') return NextResponse.json({ error: 'Not your turn' }, { status: 400 });
    if (msg === 'INVALID_MOVE') return NextResponse.json({ error: 'Invalid move' }, { status: 400 });
    console.error('[API matches/[matchId] POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
): Promise<NextResponse> {
  const { matchId } = await params;
  if (!matchId) {
    return NextResponse.json({ error: 'Missing matchId' }, { status: 400 });
  }

  await runMigrations();

  try {
    const body = await request.json();
    const { userId, action } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 });
    }

    if (!['resign', 'draw', 'acceptDraw', 'declineDraw', 'abandon'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const matchRes = await client.query(
        `SELECT * FROM matches WHERE id = $1 FOR UPDATE`,
        [matchId],
      );

      if (matchRes.rows.length === 0) throw new Error('NOT_FOUND');

      const match = matchRes.rows[0] as MatchRow;

      if (match.match_status !== 'ACTIVE') throw new Error('GAME_OVER');

      if (action === 'resign') {
        if (match.white_player_id !== userId && match.black_player_id !== userId) {
          throw new Error('FORBIDDEN');
        }

        const winnerId = match.white_player_id === userId ? match.black_player_id : match.white_player_id;

        const whiteRes = await client.query(
          `SELECT id, elo_rating, games_played FROM profiles WHERE id = $1`,
          [match.white_player_id],
        );
        const blackRes = await client.query(
          `SELECT id, elo_rating, games_played FROM profiles WHERE id = $1`,
          [match.black_player_id],
        );

        if (whiteRes.rows.length > 0 && blackRes.rows.length > 0) {
          const w = whiteRes.rows[0] as { id: string; elo_rating: number; games_played: number };
          const b = blackRes.rows[0] as { id: string; elo_rating: number; games_played: number };

          const winnerIsWhite = winnerId === match.white_player_id;
          const wOutcome = winnerIsWhite ? 1 : 0;

          const eW = expectedScore(w.elo_rating, b.elo_rating);
          const eB = expectedScore(b.elo_rating, w.elo_rating);
          const kW2 = kFactor(w.games_played);
          const kB2 = kFactor(b.games_played);

          const wD = Math.round(kW2 * (wOutcome - eW));
          const bD = Math.round(kB2 * (1 - wOutcome - eB));

          const wNE = Math.max(100, w.elo_rating + wD);
          const bNE = Math.max(100, b.elo_rating + bD);

          await client.query(
            `UPDATE profiles SET elo_rating = $1, games_played = games_played + 1,
             is_provisional = (games_played + 1) <= 15 WHERE id = $2`,
            [wNE, match.white_player_id],
          );
          await client.query(
            `UPDATE profiles SET elo_rating = $1, games_played = games_played + 1,
             is_provisional = (games_played + 1) <= 15 WHERE id = $2`,
            [bNE, match.black_player_id],
          );

          await client.query(
            `UPDATE matches
             SET match_status = 'RESIGNED', winner_id = $1,
                 white_elo_change = $2, black_elo_change = $3,
                 completed_at = clock_timestamp()
             WHERE id = $4`,
            [winnerId, wD, bD, matchId],
          );

          return {
            success: true,
            status: 'RESIGNED',
            winnerId,
            whiteEloChange: wD,
            blackEloChange: bD,
            whiteEloAfter: wNE,
            blackEloAfter: bNE,
          };
        }
      }

      if (action === 'draw') {
        if (!match.draw_offered_by) {
          await client.query(
            `UPDATE matches SET draw_offered_by = $1 WHERE id = $2`,
            [userId, matchId],
          );
          return { success: true, status: 'DRAW_OFFERED', offeredBy: userId };
        }
      }

      if (action === 'acceptDraw') {
        const whiteRes = await client.query(
          `SELECT id, elo_rating, games_played FROM profiles WHERE id = $1`,
          [match.white_player_id],
        );
        const blackRes = await client.query(
          `SELECT id, elo_rating, games_played FROM profiles WHERE id = $1`,
          [match.black_player_id],
        );

        if (whiteRes.rows.length > 0 && blackRes.rows.length > 0) {
          const w = whiteRes.rows[0] as { id: string; elo_rating: number; games_played: number };
          const b = blackRes.rows[0] as { id: string; elo_rating: number; games_played: number };

          const eW = expectedScore(w.elo_rating, b.elo_rating);
          const eB = expectedScore(b.elo_rating, w.elo_rating);
          const kW2 = kFactor(w.games_played);
          const kB2 = kFactor(b.games_played);

          const wD = Math.round(kW2 * (0.5 - eW));
          const bD = Math.round(kB2 * (0.5 - eB));

          const wNE = Math.max(100, w.elo_rating + wD);
          const bNE = Math.max(100, b.elo_rating + bD);

          await client.query(
            `UPDATE profiles SET elo_rating = $1, games_played = games_played + 1,
             is_provisional = (games_played + 1) <= 15 WHERE id = $2`,
            [wNE, match.white_player_id],
          );
          await client.query(
            `UPDATE profiles SET elo_rating = $1, games_played = games_played + 1,
             is_provisional = (games_played + 1) <= 15 WHERE id = $2`,
            [bNE, match.black_player_id],
          );

          await client.query(
            `UPDATE matches
             SET match_status = 'DRAW', winner_id = NULL,
                 white_elo_change = $1, black_elo_change = $2,
                 completed_at = clock_timestamp(),
                 draw_offered_by = NULL
             WHERE id = $3`,
            [wD, bD, matchId],
          );

          return {
            success: true,
            status: 'DRAW',
            winnerId: null,
            whiteEloChange: wD,
            blackEloChange: bD,
            whiteEloAfter: wNE,
            blackEloAfter: bNE,
          };
        }
      }

      if (action === 'declineDraw') {
        await client.query(
          `UPDATE matches SET draw_offered_by = NULL WHERE id = $1`,
          [matchId],
        );
        return { success: true, status: 'ACTIVE' };
      }

      if (action === 'abandon') {
        if (match.white_player_id !== userId && match.black_player_id !== userId) {
          throw new Error('FORBIDDEN');
        }

        const winnerId = match.white_player_id === userId ? match.black_player_id : match.white_player_id;

        await client.query(
          `UPDATE matches
           SET match_status = 'ABANDONED', winner_id = $1,
               completed_at = clock_timestamp()
           WHERE id = $2`,
          [winnerId, matchId],
        );

        return { success: true, status: 'ABANDONED', winnerId };
      }

      throw new Error('INVALID_ACTION');
    });

    if (!result) {
      return NextResponse.json({ error: 'Transaction failed' }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (msg === 'GAME_OVER') return NextResponse.json({ error: 'Game is already over' }, { status: 400 });
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Not your match' }, { status: 403 });
    if (msg === 'INVALID_ACTION') return NextResponse.json({ error: 'Invalid action for current state' }, { status: 400 });
    console.error('[API matches/[matchId] PUT]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

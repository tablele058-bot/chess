import { NextRequest, NextResponse } from 'next/server';
import { query, ChallengeRow } from '@/lib/db';

const VALID_TIME_TYPES = ['BULLET', 'BLITZ', 'RAPID', 'CUSTOM'] as const;

interface CreateChallengeBody {
  challengerId: string;
  targetUserId: string;
  timeControlType?: string;
  baseMinutes?: number;
  incrementSeconds?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateChallengeBody = await request.json();
    const { challengerId, targetUserId } = body;

    if (!challengerId || !targetUserId) {
      return NextResponse.json(
        { error: 'Missing challengerId or targetUserId' },
        { status: 400 }
      );
    }

    if (challengerId === targetUserId) {
      return NextResponse.json(
        { error: 'Cannot challenge yourself' },
        { status: 409 }
      );
    }

    const timeControlType = VALID_TIME_TYPES.includes(
      body.timeControlType as typeof VALID_TIME_TYPES[number]
    )
      ? (body.timeControlType as typeof VALID_TIME_TYPES[number])
      : 'BLITZ';

    const baseMinutes = Math.max(1, Math.min(180, body.baseMinutes ?? 3));
    const incrementSeconds = Math.max(0, Math.min(60, body.incrementSeconds ?? 2));

    const existing = await query(
      `SELECT * FROM challenges
       WHERE ((challenger_id = $1 AND challengee_id = $2)
           OR (challenger_id = $2 AND challengee_id = $1))
         AND status = 'PENDING'
       LIMIT 1`,
      [challengerId, targetUserId]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'A pending challenge already exists between you and this user' },
        { status: 409 }
      );
    }

    const result = await query(
      `INSERT INTO challenges
         (challenger_id, challengee_id, time_control_type, base_minutes, increment_seconds)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [challengerId, targetUserId, timeControlType, baseMinutes, incrementSeconds]
    );

    const challenge: ChallengeRow = {
      id: result.rows[0].id,
      challenger_id: result.rows[0].challenger_id,
      challengee_id: result.rows[0].challengee_id,
      time_control_type: result.rows[0].time_control_type,
      base_minutes: result.rows[0].base_minutes,
      increment_seconds: result.rows[0].increment_seconds,
      status: result.rows[0].status,
      created_at: result.rows[0].created_at,
    };

    return NextResponse.json({ success: true, challenge });
  } catch (err) {
    console.error('[API challenges/create]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

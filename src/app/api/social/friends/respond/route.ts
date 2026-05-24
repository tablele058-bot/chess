import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { requestId, action } = await request.json();

    if (!requestId || !action) {
      return NextResponse.json({ error: 'Missing requestId or action' }, { status: 400 });
    }
    if (action !== 'ACCEPT' && action !== 'DECLINE') {
      return NextResponse.json({ error: 'action must be ACCEPT or DECLINE' }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const existing = await client.query(
        `SELECT * FROM friendships WHERE id = $1 AND status = 'PENDING'`,
        [requestId],
      );
      if (existing.rows.length === 0) {
        throw new Error('NOT_FOUND');
      }

      if (action === 'ACCEPT') {
        const update = await client.query(
          `UPDATE friendships SET status = 'ACCEPTED' WHERE id = $1 RETURNING *`,
          [requestId],
        );
        return { success: true, friendship: update.rows[0] };
      }

      await client.query(`DELETE FROM friendships WHERE id = $1`, [requestId]);
      return { success: true, deleted: true };
    });

    if (!result) {
      return NextResponse.json({ error: 'No pending request found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    if ((err as Error).message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'No pending request found' }, { status: 404 });
    }
    console.error('[API social/friends/respond]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

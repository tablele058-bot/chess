'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Clock, Swords, ArrowLeft, Flag, Handshake, Loader2, Users } from 'lucide-react';

interface MoveRecord {
  moveNumber: number;
  playerId: string;
  san: string;
  uci: string;
  fen: string;
}

interface MatchState {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string;
  whiteUsername: string;
  blackUsername: string;
  whiteElo: number;
  blackElo: number;
  timeControlBase: number;
  timeControlIncrement: number;
  status: string;
  currentFen: string;
  whiteClockMs: number;
  blackClockMs: number;
  lastMoveAt: string | null;
  drawOfferedBy: string | null;
  winnerId: string | null;
  whiteEloChange: number;
  blackEloChange: number;
  createdAt: string;
  completedAt: string | null;
  moveHistory: MoveRecord[];
}

interface EloResult {
  whiteEloChange: number;
  blackEloChange: number;
  whiteEloAfter: number;
  blackEloAfter: number;
}

export default function ArenaLivePage() {
  const params = useParams();
  const matchId = params?.matchId as string;
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const userId = user?.id;

  const [match, setMatch] = useState<MatchState | null>(null);
  const [myColor, setMyColor] = useState<'w' | 'b' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawOffered, setDrawOffered] = useState(false);
  const [drawPending, setDrawPending] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [gameOver, setGameOver] = useState<{ status: string; winnerId: string | null } | null>(null);
  const [eloChanges, setEloChanges] = useState<EloResult | null>(null);
  const [pollError, setPollError] = useState(0);
  const [sending, setSending] = useState(false);
  const [boardInc, setBoardInc] = useState(0);
  const [whiteDisplayMs, setWhiteDisplayMs] = useState(0);
  const [blackDisplayMs, setBlackDisplayMs] = useState(0);

  const chessRef = useRef(new Chess());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMoveRef = useRef<number>(Date.now());
  const movePendingRef = useRef(0);
  const sendingRef = useRef(false);
  const draggingRef = useRef(false);

  const fetchMatch = useCallback(async () => {
    if (!matchId) return null;
    try {
      const res = await fetch(`/api/matches/${matchId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.match as MatchState;
    } catch {
      return null;
    }
  }, [matchId]);

  const submitMove = useCallback(async (from: string, to: string, promotion?: string) => {
    if (!matchId || !userId) return null;
    movePendingRef.current++;
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, from, to, promotion, clockMs: Date.now() - lastMoveRef.current }),
      });
      const data = await res.json();
      return data;
    } catch {
      return null;
    } finally {
      movePendingRef.current--;
    }
  }, [matchId, userId]);

  const sendAction = useCallback(async (action: string) => {
    if (!matchId || !userId) return null;
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      return await res.json();
    } catch {
      return null;
    }
  }, [matchId, userId]);

  useEffect(() => {
    if (!matchId || !isLoaded) return;
    if (!isSignedIn || !userId) {
      router.push('/sign-in');
      return;
    }

    const currentUserId = userId;
    let mounted = true;
    let gameOverLocal = false;

    async function fetchMatchState(): Promise<MatchState | null> {
      try {
        const res = await fetch(`/api/matches/${matchId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.match as MatchState;
      } catch {
        return null;
      }
    }

    async function init() {
      const state = await fetchMatchState();
      if (!mounted) return;

      if (!state) {
        setError('Match not found');
        setLoading(false);
        return;
      }

      setMatch(state);
      const color = state.whitePlayerId === currentUserId ? 'w' : 'b';
      setMyColor(color);
      chessRef.current = new Chess(state.currentFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

      if (state.drawOfferedBy && state.drawOfferedBy !== currentUserId) {
        setDrawOffered(true);
      }

      if (state.status !== 'ACTIVE') {
        gameOverLocal = true;
        setGameOver({ status: state.status, winnerId: state.winnerId });
        if (state.whiteEloChange !== 0 || state.blackEloChange !== 0) {
          setEloChanges({
            whiteEloChange: state.whiteEloChange,
            blackEloChange: state.blackEloChange,
            whiteEloAfter: state.whiteElo,
            blackEloAfter: state.blackElo,
          });
        }
        setLoading(false);
        return;
      }

      setWhiteDisplayMs(state.whiteClockMs);
      setBlackDisplayMs(state.blackClockMs);
      setLoading(false);

      pollRef.current = setInterval(async () => {
        const updated = await fetchMatchState();
        if (!mounted || !updated) return;

        setMatch(updated);
        setPollError(0);

        if (updated.currentFen && updated.currentFen !== chessRef.current.fen() && movePendingRef.current === 0 && !draggingRef.current) {
          chessRef.current = new Chess(updated.currentFen);
          setBoardInc((v) => v + 1);
          setWhiteDisplayMs(updated.whiteClockMs);
          setBlackDisplayMs(updated.blackClockMs);
        }

        setDrawOffered(!!(updated.drawOfferedBy && updated.drawOfferedBy !== currentUserId));
        setDrawPending(!!(updated.drawOfferedBy === currentUserId));

        if (updated.status !== 'ACTIVE' && !gameOverLocal) {
          gameOverLocal = true;
          setGameOver({ status: updated.status, winnerId: updated.winnerId });
          if (updated.whiteEloChange !== 0 || updated.blackEloChange !== 0) {
            setEloChanges({
              whiteEloChange: updated.whiteEloChange,
              blackEloChange: updated.blackEloChange,
              whiteEloAfter: updated.whiteElo,
              blackEloAfter: updated.blackElo,
            });
          }
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 800);
    }

    init();

    return () => {
      mounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [matchId, isLoaded, isSignedIn, userId, router]);

  useEffect(() => {
    if (gameOver) return;
    clockRef.current = setInterval(() => {
      const now = Date.now();
      const turn = chessRef.current.turn();
      const elapsed = now - lastMoveRef.current;

      if (turn === 'w') {
        setWhiteDisplayMs((prev) => Math.max(0, prev - elapsed));
      } else {
        setBlackDisplayMs((prev) => Math.max(0, prev - elapsed));
      }
      lastMoveRef.current = now;
    }, 200);
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, [gameOver]);

  const formatClock = (ms: number): string => {
    if (ms <= 0) return '0:00';
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const onPieceDrop = useCallback((sourceSquare: string, targetSquare: string | null, pieceType: string): boolean => {
    if (!targetSquare || sourceSquare === targetSquare || !match || gameOver || movePendingRef.current > 0) return false;
    if (myColor !== chessRef.current.turn()) return false;

    const promotion = pieceType.toLowerCase() === 'p' && targetSquare[1] === (myColor === 'w' ? '8' : '1') ? 'q' : undefined;

    let localMove;
    try {
      const localGame = new Chess(chessRef.current.fen());
      localMove = localGame.move({ from: sourceSquare, to: targetSquare, promotion });
      if (!localMove) return false;
      chessRef.current = localGame;
    } catch {
      return false;
    }

    lastMoveRef.current = Date.now();
    setBoardInc((v) => v + 1);

    submitMove(sourceSquare, targetSquare, promotion).then((result) => {
      if (!result?.success) {
        chessRef.current = new Chess(match.currentFen || 'start');
        setBoardInc((v) => v + 1);
      }
      if (result?.whiteClockMs != null) {
        setWhiteDisplayMs(result.whiteClockMs);
        setBlackDisplayMs(result.blackClockMs);
      }
      if (result?.gameOver) {
        setGameOver({ status: result.status, winnerId: result.winnerId || null });
        if (result.whiteEloChange !== undefined) {
          setEloChanges({
            whiteEloChange: result.whiteEloChange,
            blackEloChange: result.blackEloChange,
            whiteEloAfter: result.whiteEloAfter,
            blackEloAfter: result.blackEloAfter,
          });
        }
      }
    });

    return true;
  }, [match, myColor, gameOver, submitMove]);

  const handleResign = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const result = await sendAction('resign');
      if (result?.success) {
        if (pollRef.current) clearInterval(pollRef.current);
        setMatch((prev) => prev ? { ...prev, status: 'RESIGNED', winnerId: result.winnerId, whiteEloChange: result.whiteEloChange ?? 0, blackEloChange: result.blackEloChange ?? 0 } : prev);
        setGameOver({ status: 'RESIGNED', winnerId: result.winnerId });
        if (result.whiteEloChange !== undefined) {
          setEloChanges({
            whiteEloChange: result.whiteEloChange,
            blackEloChange: result.blackEloChange,
            whiteEloAfter: result.whiteEloAfter,
            blackEloAfter: result.blackEloAfter,
          });
        }
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleDrawOffer = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const result = await sendAction('draw');
      if (result?.success) {
        setDrawPending(true);
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleDrawAccept = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const result = await sendAction('acceptDraw');
      if (result?.success) {
        if (pollRef.current) clearInterval(pollRef.current);
        setMatch((prev) => prev ? { ...prev, status: 'DRAW', winnerId: null, drawOfferedBy: null, whiteEloChange: result.whiteEloChange ?? 0, blackEloChange: result.blackEloChange ?? 0 } : prev);
        setDrawOffered(false);
        setGameOver({ status: 'DRAW', winnerId: null });
        if (result.whiteEloChange !== undefined) {
          setEloChanges({
            whiteEloChange: result.whiteEloChange,
            blackEloChange: result.blackEloChange,
            whiteEloAfter: result.whiteEloAfter,
            blackEloAfter: result.blackEloAfter,
          });
        }
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleDrawDecline = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      await sendAction('declineDraw');
      setDrawOffered(false);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const fen = chessRef.current.fen();
  const isMyTurn = myColor === chessRef.current.turn();
  const isActive = match?.status === 'ACTIVE';
  const opponentName = myColor === 'w' ? match?.blackUsername : match?.whiteUsername;
  const opponentElo = myColor === 'w' ? match?.blackElo : match?.whiteElo;
  const myName = myColor === 'w' ? match?.whiteUsername : match?.blackUsername;
  const myElo = myColor === 'w' ? match?.whiteElo : match?.blackElo;

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#161513] flex flex-col items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin text-emerald-400" />
        <div className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-widest animate-pulse">
          Joining match...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#161513] flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-sm font-bold">{error}</div>
        <button onClick={() => router.push('/profile')} className="text-xs font-bold uppercase tracking-wider text-white bg-emerald-600 px-4 py-2 rounded-lg">
          Back to Profile
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#161513] text-[#e4e4e4] flex flex-col antialiased">
      <header className="h-[56px] min-h-[56px] flex items-center justify-between px-6 bg-[#211f1c] border-b border-[#2d2b27] shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/profile')} className="text-[#bababa] hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="bg-emerald-600 p-1.5 rounded-md flex items-center justify-center text-white font-black tracking-tighter text-sm">W</div>
          <span className="font-sans font-black tracking-tight text-md text-white">
            LIVE <span className="text-emerald-500">ARENA</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${pollError < 3 ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-[10px] font-mono text-[#615e59]">{pollError < 3 ? 'Connected' : 'Reconnecting...'}</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row items-start justify-center gap-4 p-4 lg:p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-between w-full bg-[#211f1c] border border-[#2d2b27] rounded-lg px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-xs font-bold text-white">
                {opponentName?.slice(0, 2).toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-xs font-bold text-white">{opponentName || 'Opponent'}</div>
                <div className="text-[10px] text-[#615e59] font-mono">{opponentElo || '?'} ELO</div>
              </div>
            </div>
            <div className={`text-xl font-black font-mono ${myColor === 'w' ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatClock(myColor === 'w' ? blackDisplayMs : whiteDisplayMs)}
            </div>
          </div>

          <div className="w-full max-w-[480px]">
            <Chessboard
              options={{
                position: fen,
                boardOrientation: myColor === 'b' ? 'black' : 'white',
                onPieceDrag: () => { draggingRef.current = true; },
                onPieceClick: () => { draggingRef.current = false; },
                onPieceDrop: ({ sourceSquare, targetSquare, piece }) => {
                  draggingRef.current = false;
                  return onPieceDrop(sourceSquare, targetSquare ?? null, piece.pieceType);
                },
                boardStyle: {
                  borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                },
                darkSquareStyle: { backgroundColor: '#4a7c59' },
                lightSquareStyle: { backgroundColor: '#e8d5b5' },
                animationDurationInMs: 200,
                allowDragging: isActive && isMyTurn && !gameOver,
              }}
            />
          </div>

          <div className="flex items-center justify-between w-full bg-[#211f1c] border border-[#2d2b27] rounded-lg px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                {myName?.slice(0, 2).toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-xs font-bold text-white">{myName || 'You'}</div>
                <div className="text-[10px] text-[#615e59] font-mono">{myElo || '?'} ELO</div>
              </div>
            </div>
            <div className={`text-xl font-black font-mono ${myColor === 'b' ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatClock(myColor === 'b' ? blackDisplayMs : whiteDisplayMs)}
            </div>
          </div>

          {!gameOver && isActive && (
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={handleResign}
                disabled={sending}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-all ${
                  sending
                    ? 'bg-gray-600/10 border border-gray-500/30 text-gray-400 cursor-not-allowed'
                    : 'bg-red-600/10 hover:bg-red-600 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-white'
                }`}
              >
                <Flag size={14} /> Resign
              </button>
              <button
                onClick={handleDrawOffer}
                disabled={sending || drawPending}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-all ${
                  sending || drawPending
                    ? 'bg-gray-600/10 border border-gray-500/30 text-gray-400 cursor-not-allowed'
                    : 'bg-yellow-600/10 hover:bg-yellow-600 border border-yellow-500/30 hover:border-yellow-500 text-yellow-400 hover:text-white'
                }`}
              >
                <Handshake size={14} /> {drawPending ? 'Draw Requested' : 'Offer Draw'}
              </button>
            </div>
          )}

          {drawOffered && !gameOver && (
            <div className="w-full bg-[#211f1c] border border-yellow-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-yellow-400 font-bold flex items-center gap-2">
                <Handshake size={14} /> Opponent offers a draw
              </span>
              <div className="flex items-center gap-2">
                <button onClick={handleDrawAccept} disabled={sending} className={`text-xs font-bold px-3 py-1.5 rounded ${sending ? 'bg-gray-600/10 text-gray-400 cursor-not-allowed' : 'text-white bg-emerald-600'}`}>Accept</button>
                <button onClick={handleDrawDecline} disabled={sending} className={`text-xs font-bold px-3 py-1.5 rounded ${sending ? 'bg-gray-600/10 text-gray-400 cursor-not-allowed' : 'text-[#bababa] bg-[#363431]'}`}>Decline</button>
              </div>
            </div>
          )}

          {opponentDisconnected && !gameOver && (
            <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
              <span className="text-xs text-amber-400 font-bold flex items-center gap-2">
                <Users size={14} /> Opponent disconnected — waiting for reconnection...
              </span>
            </div>
          )}
        </div>

        <div className="w-full lg:w-72 bg-[#211f1c] border border-[#2d2b27] rounded-lg shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2d2b27] bg-[#1b1a18] flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <Swords size={13} className="text-emerald-500" /> Moves
            </h2>
            <span className="text-[10px] text-[#615e59] font-mono">{(match?.moveHistory.length || 0)} ply</span>
          </div>
          <div className="p-3 max-h-[400px] overflow-y-auto minimal-scrollbar">
            {(!match?.moveHistory || match.moveHistory.length === 0) ? (
              <div className="text-[10px] text-[#615e59] text-center py-6">Waiting for first move...</div>
            ) : (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {match.moveHistory.map((move, i) => (
                  <div key={i} className={`text-xs font-mono ${i % 2 === 0 ? 'col-start-1' : 'col-start-2'}`}>
                    <span className="text-[#615e59] mr-1">{(i % 2 === 0 ? Math.floor(i / 2) + 1 : '')}</span>
                    <span className={i === match.moveHistory.length - 1 ? 'text-emerald-400 font-bold' : 'text-[#e4e4e4]'}>
                      {move.san}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center mx-auto mb-4">
              <Swords size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Game Over</h2>
            <p className="text-sm text-[#bababa] mb-1 capitalize">{gameOver.status.toLowerCase()}</p>
            {gameOver.winnerId ? (
              <p className="text-xs text-emerald-400 font-bold mb-4">
                {gameOver.winnerId === user?.id ? 'You won!' : `${opponentName} won`}
              </p>
            ) : (
              <p className="text-xs text-yellow-400 font-bold mb-4">Draw</p>
            )}

            {eloChanges && (
              <div className="flex items-center justify-center gap-6 mb-4 bg-[#161513] rounded-lg px-4 py-3 border border-[#2d2b27]">
                <div className="text-center">
                  <div className="text-[10px] font-mono text-[#615e59]">Your ELO</div>
                  <div className={`text-lg font-black font-mono ${myColor === 'w' ? (eloChanges.whiteEloChange >= 0 ? 'text-emerald-400' : 'text-red-400') : (eloChanges.blackEloChange >= 0 ? 'text-emerald-400' : 'text-red-400')}`}>
                    {myColor === 'w' ? eloChanges.whiteEloAfter : eloChanges.blackEloAfter}
                    <span className="text-xs ml-1">
                      ({myColor === 'w' ? (eloChanges.whiteEloChange >= 0 ? '+' : '') + eloChanges.whiteEloChange : (eloChanges.blackEloChange >= 0 ? '+' : '') + eloChanges.blackEloChange})
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => router.push('/profile')}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors"
            >
              Back to Profile
            </button>
          </div>
        </div>
      )}

      <style>{`
        .minimal-scrollbar::-webkit-scrollbar { width: 4px; }
        .minimal-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .minimal-scrollbar::-webkit-scrollbar-thumb { background: #3c3934; border-radius: 2px; }
        .minimal-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a4640; }
      `}</style>
    </div>
  );
}

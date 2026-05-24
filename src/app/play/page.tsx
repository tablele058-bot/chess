'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { Chessboard } from 'react-chessboard';
import { useGame, BOARD_THEMES, MOVE_QUALITY_STYLES } from '@/hooks/useGame';
import { Chess } from 'chess.js';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  User, Shield, Zap, RotateCcw, Grid2X2, Box,
  ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight,
  Undo2, Shuffle, Trophy, Settings, BarChart3, Radio, HelpCircle
} from 'lucide-react';

function formatEval(score: number | null): string {
  if (score === null) return '0.0';
  if (Math.abs(score) > 100000) {
    const mateIn = Math.abs(score) - 100000;
    return `M${mateIn}`;
  }
  const display = score / 100;
  return display > 0 ? `+${display.toFixed(1)}` : display.toFixed(1);
}

const STORAGE_KEY = 'sujana_tech_chess_history';
const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

export default function ChessApp() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#161513] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChessAppContent />
    </Suspense>
  );
}

function ChessAppContent() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [activeTab, setActiveTab] = useState<'play' | 'review' | 'settings' | 'stats'>('play');

  const [analysisFen, setAnalysisFen] = useState<string | null>(null);
  const [analysisEval, setAnalysisEval] = useState<number | null>(null);
  const [hasSavedGame, setHasSavedGame] = useState<boolean>(false);
  const [reviewGameId, setReviewGameId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevModeRef = useRef<string | null>(null);

  const {
    fen,
    moveHistory,
    fenHistory,
    squareStyles,
    botElo,
    setBotElo,
    isAiThinking,
    engineStatus,
    evaluation,
    onSquareClick,
    resetGame,
    status,
    undoMove,
    isFlipped,
    flipBoard,
    boardTheme,
    boardThemeIndex,
    setBoardThemeIndex,
    turn,
    viewedMoveIndex,
    isViewingHistory,
    goToStart,
    goBack,
    goForward,
    goToLive,
    arePiecesDraggable,
    jumpToMove,
    loadGameHistory,
    promotionPending,
    promote,
    cancelPromotion,
    lastMoveQuality,
    showHint,
    hintUndo,
    acknowledgeHint,
    isLocalMode,
    toggleLocalMode,
    setLocalMode,
    moveQualitiesRef,
    requestHint,
    clearHint,
    hintSquares,
    hintMove,
    analyzeGame,
    clearAnalysis,
    analysisResults,
    isAnalyzing,
    powerfulMode,
    setPowerfulMode,
    engineSource,
  } = useGame();

  useEffect(() => {
    const mode = searchParams.get('mode');
    const reviewId = searchParams.get('reviewGameId');
    setReviewGameId(reviewId);
    if (mode !== prevModeRef.current) {
      prevModeRef.current = mode;
      setLocalMode(mode === 'local');
    }
  }, [searchParams, setLocalMode]);

  useEffect(() => {
    const isGameOver = status === 'Checkmate!' || status === 'Draw' || status === 'Stalemate';
    if (isGameOver && !hasSavedGame && moveHistory.length > 0 && user) {
      setHasSavedGame(true);
      const gamePayload = {
        id: reviewGameId || `game-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
        userId: user.id,
        opponent: `Stockfish Lvl (${Math.floor(botElo / 400)})`,
        result: status === 'Checkmate!' ? (turn === 'b' ? 'Won' : 'Lost') : 'Draw',
        isBot: true,
        elo: botElo,
        moves: moveHistory,
        fenHistory: fenHistory,
        playedAt: new Date().toISOString()
      };
      fetch(`${SERVER_URL}/api/games/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gamePayload)
      })
        .then((res) => res.json())
        .then(() => console.log('Match saved to database'))
        .catch(() => {
          const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
          if (!local.some((g: any) => g.id === gamePayload.id)) {
            local.unshift(gamePayload);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
          }
        });
    }
  }, [status, moveHistory, hasSavedGame, user, turn, botElo, fenHistory, reviewGameId]);

  useEffect(() => {
    const isGameOver = status === 'Checkmate!' || status === 'Draw' || status === 'Stalemate';
    if (isGameOver && isLocalMode && !analysisResults && !isAnalyzing && moveHistory.length > 0) {
      setActiveTab('review');
      analyzeGame();
    }
  }, [status, isLocalMode, analysisResults, isAnalyzing, moveHistory.length, analyzeGame]);

  useEffect(() => {
    if (!reviewGameId) return;
    fetch(`${SERVER_URL}/api/games/${reviewGameId}/moves`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.moves) loadGameHistory(data.moves);
      })
      .catch(() => {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const match = local.find((g: any) => g.id === reviewGameId);
        if (match) loadGameHistory(match.moves);
      });
  }, [reviewGameId, loadGameHistory]);

  useEffect(() => {
    if (scrollRef.current && moveHistory.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moveHistory.length]);

  useEffect(() => {
    if (viewedMoveIndex === null) {
      setAnalysisFen(null);
      setAnalysisEval(null);
      return;
    }
    const activeFen = fenHistory[viewedMoveIndex] || fen;
    setAnalysisFen(activeFen);
    try {
      const tmp = new Chess(activeFen);
      let score = 0;
      const w: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
      tmp.board().flat().forEach((p) => {
        if (!p) return;
        score += p.color === 'w' ? w[p.type] : -w[p.type];
      });
      setAnalysisEval(score);
    } catch {
      setAnalysisEval(evaluation);
    }
  }, [viewedMoveIndex, fenHistory, fen, evaluation]);

  const handleAnalysisSquareClick = (square: string) => {
    if (isViewingHistory && !analysisFen) return;
    onSquareClick(square);
  };

  const activeFenDisplay = viewedMoveIndex !== null && analysisFen ? analysisFen : fen;
  const activeEvalDisplay = viewedMoveIndex !== null && analysisEval !== null ? analysisEval : evaluation;
  const barPercent = activeEvalDisplay === null ? 50 : Math.max(5, Math.min(95, 50 + (activeEvalDisplay / 500) * 50));
  const evalText = formatEval(activeEvalDisplay);

  const renderMovePairs = () => {
    const pairs: { num: number; white: string; whiteIdx: number; black: string; blackIdx: number }[] = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: moveHistory[i],
        whiteIdx: i + 1,
        black: moveHistory[i + 1] || '',
        blackIdx: i + 2,
      });
    }
    return pairs;
  };

  return (
    <main className="min-h-screen bg-[#161513] text-[#e4e4e4] flex flex-col antialiased select-none">
      {viewMode === '3d' && (
        <style>{`
          .cg-board piece { transform: translateZ(16px) rotateX(-26deg) !important; filter: drop-shadow(4px 8px 12px rgba(0,0,0,0.6)) !important; transform-style: preserve-3d !important; }
          .cg-board { transform-style: preserve-3d !important; }
        `}</style>
      )}

      <header className="flex items-center justify-between px-6 py-3 bg-[#211f1c] border-b border-[#2d2b27] shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-1.5 rounded-md flex items-center justify-center text-white font-black tracking-tighter text-sm">W</div>
          <span className="font-sans font-black tracking-tight text-md text-[#ffffff]">
            CHESS<span className="text-emerald-500">.COM</span> <span className="font-light text-xs uppercase tracking-widest text-[#bababa] ml-1">Pro Arena</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/profile')} className="text-xs font-bold uppercase tracking-wider text-[#bababa] hover:text-white bg-[#262421] px-3 py-1.5 rounded border border-[#3c3934] transition-colors">
            <User size={13} className="inline mr-1" /> Profile
          </button>
          <button onClick={() => setViewMode('2d')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${viewMode === '2d' ? 'bg-[#363431] text-emerald-400 border border-[#4a4640] shadow-inner' : 'text-[#bababa] hover:text-white'}`}>
            <Grid2X2 size={14} /> 2D
          </button>
          <button onClick={() => setViewMode('3d')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${viewMode === '3d' ? 'bg-[#363431] text-emerald-400 border border-[#4a4640] shadow-inner' : 'text-[#bababa] hover:text-white'}`}>
            <Box size={14} /> 3D
          </button>
        </div>
      </header>

      <div className="flex-1 w-full max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-6 items-stretch">

        <div className="lg:col-span-8 flex flex-col justify-between gap-4">

          <div className="w-full flex items-center justify-between bg-[#211f1c] border border-[#2d2b27] rounded-lg px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-tr from-amber-600 to-red-500 rounded flex items-center justify-center border border-amber-400/20 text-white font-bold text-sm shadow-md">AI</div>
              <div>
                <div className="flex items-center gap-1.5">
                  {isLocalMode ? (
                    <>
                      <span className="font-bold text-sm text-white">Local Trainer</span>
                      <span className="bg-amber-500/10 text-amber-400 text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-amber-500/20">2-Player</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-sm text-white">Stockfish Engine</span>
                      <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-emerald-500/20">Bot</span>
                    </>
                  )}
                </div>
                <span className="text-xs text-[#bababa] font-mono block">{isLocalMode ? 'Two players, auto-flip enabled' : `Strength: ${botElo} ELO`}</span>
              </div>
            </div>
            {reviewGameId ? (
              <div className="text-xs text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 flex items-center gap-1.5">
                <Zap size={12} /> Review Mode
              </div>
            ) : !isLocalMode && status === 'In Progress' && turn === 'b' && viewedMoveIndex === null ? (
              <div className="flex items-center gap-2 text-xs text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 animate-pulse">
                <Radio size={12} /> Engine Calculating...
              </div>
            ) : isLocalMode && status === 'In Progress' && viewedMoveIndex === null ? (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                <Shuffle size={12} /> Auto-Flip Active
              </div>
            ) : null}
          </div>

          <div className="w-full flex-1 flex items-center justify-center py-2">
            <div className="w-full max-w-[620px] aspect-square flex rounded-md bg-[#262421] border border-[#2d2b27] shadow-2xl relative overflow-hidden">

              <div className="w-6 shrink-0 bg-[#161513] border-r border-[#2d2b27] relative flex flex-col justify-between overflow-hidden">
                <div className="w-full bg-[#262421] transition-all duration-500 ease-out" style={{ height: `${100 - barPercent}%` }} />
                <div className="w-full bg-[#ffffff] transition-all duration-500 ease-out" style={{ height: `${barPercent}%` }} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <span className="text-[10px] font-mono font-black select-none tracking-tighter" style={{ color: barPercent > 50 ? '#161513' : '#ffffff', writingMode: 'vertical-rl', textOrientation: 'mixed' }}>{evalText}</span>
                </div>
                <div className="absolute left-0 right-0 h-px bg-[#4e4a43] z-10" style={{ top: '50%' }} />
              </div>

              <div className="flex-1 h-full relative" style={{ perspective: viewMode === '3d' ? '1200px' : 'none' }}>
                {hintMove && !isViewingHistory && (
                  <div className="absolute top-2 left-2 z-10 bg-emerald-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-lg border border-emerald-400/40 backdrop-blur-sm flex items-center gap-1.5 pointer-events-none">
                    <Zap size={12} /> Best: {hintMove}
                  </div>
                )}
                <div className="w-full h-full transition-transform duration-700 ease-out relative" style={{ transform: viewMode === '3d' ? 'rotateX(26deg) rotateZ(-3deg) scale(0.96)' : 'none', transformStyle: 'preserve-3d' }}>
                  <Chessboard options={{
                    position: activeFenDisplay,
                    boardOrientation: isFlipped ? 'black' : 'white',
                    onSquareClick: ({ square }) => handleAnalysisSquareClick(square),
                    squareStyles: viewedMoveIndex !== null ? {} : squareStyles,
                    darkSquareStyle: { backgroundColor: boardTheme.dark },
                    lightSquareStyle: { backgroundColor: boardTheme.light },
                    allowDragging: viewedMoveIndex === null && arePiecesDraggable && !isAiThinking,
                  }} />
                </div>
              </div>

            </div>
          </div>

          <div className="w-full flex items-center justify-between bg-[#211f1c] border border-[#2d2b27] rounded-lg px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded flex items-center justify-center border border-emerald-400/20 text-white font-bold text-sm shadow-md uppercase">
                {user?.username?.slice(0, 2) || 'PL'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-white">{user?.username || 'Player'}</span>
                  <Shield size={13} className="text-emerald-400" />
                </div>
                <span className="text-xs text-[#bababa] font-mono block">Clerk Authorized User</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {status === 'In Progress' && !isAiThinking && viewedMoveIndex === null && (
                <div className={`text-xs font-bold px-2.5 py-1 rounded border ${turn === 'w' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                  {turn === 'w' ? (isLocalMode ? "White's Turn" : 'Your Turn') : (isLocalMode ? "Black's Turn" : 'Bot Thinking...')}
                </div>
              )}
              {engineStatus && !isLocalMode && (
                <div className="flex items-center gap-1.5">
                  {engineSource === 'cloud' && (
                    <div className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                      <Zap size={10} /> SERVER
                    </div>
                  )}
                  <div className="text-xs text-[#bababa] font-mono px-2.5 py-1 rounded bg-[#161513] border border-[#2d2b27]">{engineStatus}</div>
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="lg:col-span-4 flex flex-col bg-[#211f1c] border border-[#2d2b27] rounded-lg shadow-xl overflow-hidden" style={{ maxHeight: 'calc(100dvh - 100px)' }}>

          <div className="flex bg-[#1b1a18] border-b border-[#2d2b27] p-1 gap-1 shrink-0">
            <button onClick={() => setActiveTab('play')} className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all ${activeTab === 'play' ? 'bg-[#262421] text-white shadow' : 'text-[#bababa] hover:text-white'}`}><Radio size={14} /> Game Sheet</button>
            <button onClick={() => setActiveTab('review')} className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all ${activeTab === 'review' ? 'bg-[#262421] text-white shadow' : 'text-[#bababa] hover:text-white'}`}><BarChart3 size={14} /> Review</button>
            <button onClick={() => setActiveTab('settings')} className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all ${activeTab === 'settings' ? 'bg-[#262421] text-white shadow' : 'text-[#bababa] hover:text-white'}`}><Settings size={14} /> Settings</button>
            <button onClick={() => setActiveTab('stats')} className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all ${activeTab === 'stats' ? 'bg-[#262421] text-white shadow' : 'text-[#bababa] hover:text-white'}`}><BarChart3 size={14} /> Stats</button>
          </div>

          <div className="flex-1 flex flex-col min-h-0">

            {activeTab === 'play' && (
              <div className="flex-1 flex flex-col min-h-0 bg-[#161513]">
                <div className="flex-1 overflow-y-auto min-h-0 p-3 font-mono text-xs minimal-scrollbar" ref={scrollRef}>
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-[#161513] border-b border-[#2d2b27] z-20">
                      <tr className="text-[10px] text-[#615e59] uppercase font-bold tracking-wider">
                        <th className="w-12 text-center py-2">Ply</th>
                        <th className="text-left py-2 px-2">White (You)</th>
                        <th className="text-left py-2 px-2">Black (Bot)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#211f1c]">
                      {renderMovePairs().map((pair) => (
                        <tr key={pair.num} className="hover:bg-[#211f1c]/40 transition-colors group">
                          <td className="text-center font-bold text-[#615e59] py-1.5 text-[11px] bg-[#1b1a18]/20">{pair.num}.</td>
                          <td className="p-1">
                            <div className="flex items-center gap-1">
                              <button onClick={() => jumpToMove(pair.whiteIdx)} className={`flex-1 text-left px-2 py-1 rounded text-xs font-semibold transition-all ${viewedMoveIndex === pair.whiteIdx ? 'bg-amber-400 text-black font-black shadow-md scale-[1.01]' : 'text-[#e4e4e4] hover:bg-[#262421]'}`}>{pair.white}</button>
                              {moveQualitiesRef.current[pair.whiteIdx] && (
                                <span className={`text-[10px] font-black px-1 rounded border ${MOVE_QUALITY_STYLES[moveQualitiesRef.current[pair.whiteIdx].type].bg} ${MOVE_QUALITY_STYLES[moveQualitiesRef.current[pair.whiteIdx].type].text} ${MOVE_QUALITY_STYLES[moveQualitiesRef.current[pair.whiteIdx].type].border}`}>
                                  {moveQualitiesRef.current[pair.whiteIdx].symbol}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-1">
                            {pair.black ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => jumpToMove(pair.blackIdx)} className={`flex-1 text-left px-2 py-1 rounded text-xs font-semibold transition-all ${viewedMoveIndex === pair.blackIdx ? 'bg-amber-400 text-black font-black shadow-md scale-[1.01]' : 'text-emerald-400 hover:bg-[#262421]'}`}>{pair.black}</button>
                                {moveQualitiesRef.current[pair.blackIdx] && (
                                  <span className={`text-[10px] font-black px-1 rounded border ${MOVE_QUALITY_STYLES[moveQualitiesRef.current[pair.blackIdx].type].bg} ${MOVE_QUALITY_STYLES[moveQualitiesRef.current[pair.blackIdx].type].text} ${MOVE_QUALITY_STYLES[moveQualitiesRef.current[pair.blackIdx].type].border}`}>
                                    {moveQualitiesRef.current[pair.blackIdx].symbol}
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {moveHistory.length === 0 && (
                    <div className="text-center text-[#615e59] font-sans py-24 text-xs">Click a square to begin your first move</div>
                  )}
                </div>

                <div className="p-3 bg-[#1b1a18] border-t border-[#2d2b27] flex flex-col gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button onClick={goToStart} disabled={moveHistory.length === 0} className="flex-1 py-2 bg-[#262421] hover:bg-[#312e2b] disabled:opacity-20 text-white rounded transition-colors flex justify-center border border-[#3c3934] shadow-sm"><ChevronsLeft size={16} /></button>
                    <button onClick={goBack} disabled={moveHistory.length === 0} className="flex-1 py-2 bg-[#262421] hover:bg-[#312e2b] disabled:opacity-20 text-white rounded transition-colors flex justify-center border border-[#3c3934] shadow-sm"><ArrowLeft size={16} /></button>
                    <button onClick={goForward} disabled={viewedMoveIndex === null} className="flex-1 py-2 bg-[#262421] hover:bg-[#312e2b] disabled:opacity-20 text-white rounded transition-colors flex justify-center border border-[#3c3934] shadow-sm"><ArrowRight size={16} /></button>
                    <button onClick={goToLive} disabled={viewedMoveIndex === null} className="flex-1 py-2 bg-[#262421] hover:bg-[#312e2b] disabled:opacity-20 text-white rounded transition-colors flex justify-center border border-[#3c3934] shadow-sm"><ChevronsRight size={16} /></button>
                  </div>
                  {isViewingHistory && (
                    <button onClick={goToLive} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-extrabold py-2 px-4 rounded text-xs transition-colors shadow-md flex items-center justify-center gap-2 uppercase tracking-wider font-sans">
                      <Zap size={14} /> Close Analysis • Return to Live Turn
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="flex-1 p-4 space-y-5 bg-[#262421] overflow-y-auto">
                {!isLocalMode && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-[#bababa]">
                      <span>Bot Skill Rating</span>
                      <span className="text-emerald-400 font-mono font-black">{botElo} ELO</span>
                    </div>
                    <input type="range" min="400" max="2600" step="100" value={botElo} onChange={(e) => setBotElo(Number(e.target.value))} className="w-full accent-emerald-500 cursor-pointer bg-[#3a3732] h-1.5 rounded appearance-none" />
                  </div>
                )}
                {!isLocalMode && (
                  <div className="bg-[#161513] p-3.5 rounded-lg border border-[#2d2b27] space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#bababa]">Powerful Mode</span>
                        <p className="text-[10px] text-[#615e59] mt-0.5">Use server Stockfish pool for GM-depth analysis</p>
                      </div>
                      <button onClick={() => setPowerfulMode(!powerfulMode)} className={`relative w-12 h-6 rounded-full transition-colors ${powerfulMode ? 'bg-purple-500' : 'bg-[#3a3732]'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${powerfulMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    {powerfulMode && (
                      <div className="flex items-center gap-1.5 text-[10px] text-purple-400 font-bold bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">
                        <Zap size={11} /> Active • Engine source: {engineSource === 'cloud' ? 'Server Stockfish (depth 30)' : 'Local Stockfish'}
                      </div>
                    )}
                  </div>
                )}
                <div className="bg-[#161513] p-3.5 rounded-lg border border-[#2d2b27] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#bababa]">Local Trainer Mode</span>
                      <p className="text-[10px] text-[#615e59] mt-0.5">Two players, same laptop, auto-flip</p>
                    </div>
                    <button onClick={toggleLocalMode} className={`relative w-12 h-6 rounded-full transition-colors ${isLocalMode ? 'bg-emerald-500' : 'bg-[#3a3732]'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isLocalMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#bababa]">Board Theme</span>
                  <div className="grid grid-cols-2 gap-2">
                    {BOARD_THEMES.map((t, i) => (
                      <button key={t.name} onClick={() => setBoardThemeIndex(i)} className={`p-2.5 rounded-lg border flex items-center gap-3 bg-[#1b1a18] text-left transition-all ${i === boardThemeIndex ? 'border-emerald-500 text-white ring-1 ring-emerald-500/30' : 'border-[#3c3934] text-[#bababa] hover:bg-[#2d2b27]'}`}>
                        <div className="w-6 h-6 rounded-full border border-[#4a4640] overflow-hidden shrink-0 flex flex-col">
                          <div className="w-full h-1/2" style={{ backgroundColor: t.light }} />
                          <div className="w-full h-1/2" style={{ backgroundColor: t.dark }} />
                        </div>
                        <span className="text-xs font-semibold truncate">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="flex-1 p-4 bg-[#262421] space-y-4 font-sans text-sm overflow-y-auto">
                <div className="bg-[#161513] p-4 rounded-lg border border-[#2d2b27] space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#615e59] flex items-center gap-1.5"><Trophy size={14} /> Match Telemetry</h3>
                  <div className="grid grid-cols-2 gap-3 text-center pt-1">
                    <div className="bg-[#211f1c] p-2.5 rounded border border-[#2d2b27]">
                      <div className="text-[10px] text-[#bababa] uppercase">Turn</div>
                      <div className="text-md font-bold font-mono text-white mt-0.5 uppercase">{turn === 'w' ? 'White' : 'Black'}</div>
                    </div>
                    <div className="bg-[#211f1c] p-2.5 rounded border border-[#2d2b27]">
                      <div className="text-[10px] text-[#bababa] uppercase">Plies</div>
                      <div className="text-md font-bold font-mono text-emerald-400 mt-0.5">{moveHistory.length}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-[#161513] p-3.5 rounded-lg border border-[#2d2b27] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#bababa]">Status</span>
                  <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                    status === 'Checkmate!' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    status.includes('Draw') || status.includes('Stalemate') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>{status}</span>
                </div>
              </div>
            )}

            {activeTab === 'review' && (
              <div className="flex-1 bg-[#262421] overflow-y-auto">
                {isAnalyzing && !analysisResults && (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-xs text-[#bababa] font-semibold">Analyzing game...</p>
                    <p className="text-[10px] text-[#615e59] mt-1">Evaluating each move with Stockfish</p>
                  </div>
                )}
                {analysisResults && (
                  <div className="p-3 space-y-1">
                    {(() => {
                      const counts: Record<string, number> = {};
                      const pairs = [];
                      for (let i = 0; i < moveHistory.length; i += 2) {
                        pairs.push({
                          num: Math.floor(i / 2) + 1,
                          white: moveHistory[i],
                          whiteIdx: i + 1,
                          black: moveHistory[i + 1] || '',
                          blackIdx: i + 2,
                        });
                      }
                      return (
                        <table className="w-full border-collapse">
                          <thead className="sticky top-0 bg-[#262421] z-20 border-b border-[#2d2b27]">
                            <tr className="text-[10px] text-[#615e59] uppercase font-bold tracking-wider">
                              <th className="w-10 text-center py-2">#</th>
                              <th className="text-left py-2 px-1">White</th>
                              <th className="w-12" />
                              <th className="text-left py-2 px-1">Black</th>
                              <th className="w-12" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#211f1c]">
                            {pairs.map((pair) => (
                              <tr key={pair.num} className="hover:bg-[#211f1c]/40 transition-colors text-xs">
                                <td className="text-center text-[#615e59] font-bold py-1.5">{pair.num}.</td>
                                <td className="py-1 px-1 font-semibold text-white">{pair.white}</td>
                                <td className="py-1">
                                  {analysisResults[pair.whiteIdx] && (
                                    <span className={`text-[10px] font-black px-1 rounded border ${MOVE_QUALITY_STYLES[analysisResults[pair.whiteIdx].type].bg} ${MOVE_QUALITY_STYLES[analysisResults[pair.whiteIdx].type].text} ${MOVE_QUALITY_STYLES[analysisResults[pair.whiteIdx].type].border}`}>
                                      {analysisResults[pair.whiteIdx].symbol}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1 px-1 font-semibold text-emerald-400">{pair.black || ''}</td>
                                <td className="py-1">
                                  {pair.black && analysisResults[pair.blackIdx] && (
                                    <span className={`text-[10px] font-black px-1 rounded border ${MOVE_QUALITY_STYLES[analysisResults[pair.blackIdx].type].bg} ${MOVE_QUALITY_STYLES[analysisResults[pair.blackIdx].type].text} ${MOVE_QUALITY_STYLES[analysisResults[pair.blackIdx].type].border}`}>
                                      {analysisResults[pair.blackIdx].symbol}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                    {(() => {
                      if (!analysisResults) return null;
                      const c: Record<string, number> = {};
                      Object.values(analysisResults).forEach((q) => {
                        c[q.label] = (c[q.label] || 0) + 1;
                      });
                      return (
                        <div className="mt-4 pt-3 border-t border-[#2d2b27] grid grid-cols-3 gap-2">
                          {Object.entries(c).map(([label, count]) => (
                            <div key={label} className="bg-[#161513] rounded p-2 text-center border border-[#2d2b27]">
                              <div className="text-lg font-black">{count}</div>
                              <div className="text-[10px] text-[#615e59] font-semibold">{label}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

          </div>

          <div className={`p-3 bg-[#1b1a18] border-t border-[#2d2b27] grid ${isLocalMode ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
            <button onClick={() => { setHasSavedGame(false); resetGame(); }} className="py-2.5 px-2 bg-[#363431] hover:bg-[#45423e] text-[#e4e4e4] text-xs font-bold rounded border border-[#4a4640] transition-colors flex flex-col items-center justify-center gap-1 shadow">
              <RotateCcw size={14} /> <span>New Game</span>
            </button>
            <button onClick={undoMove} disabled={moveHistory.length === 0 || isAiThinking} className="py-2.5 px-2 bg-[#363431] hover:bg-[#45423e] disabled:opacity-20 text-[#e4e4e4] text-xs font-bold rounded border border-[#4a4640] transition-colors flex flex-col items-center justify-center gap-1 shadow">
              <Undo2 size={14} /> <span>Undo</span>
            </button>
            <button onClick={() => { clearHint(); requestHint(); }} className={`py-2.5 px-2 text-xs font-bold rounded border transition-colors flex flex-col items-center justify-center gap-1 shadow ${isLocalMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500' : 'hidden'}`}>
              <BarChart3 size={14} /> <span>Hint</span>
            </button>
            <button onClick={flipBoard} className="py-2.5 px-2 bg-[#363431] hover:bg-[#45423e] text-[#e4e4e4] text-xs font-bold rounded border border-[#4a4640] transition-colors flex flex-col items-center justify-center gap-1 shadow">
              <Shuffle size={14} /> <span>Flip</span>
            </button>
          </div>

        </div>
      </div>
      {promotionPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl p-5 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-[#bababa] text-center mb-4">Promote Pawn</p>
            <div className="flex gap-3">
              {(
                [
                  { piece: 'q', label: '♛', name: 'Queen' },
                  { piece: 'r', label: '♜', name: 'Rook' },
                  { piece: 'b', label: '♝', name: 'Bishop' },
                  { piece: 'n', label: '♞', name: 'Knight' },
                ] as const
              ).map(({ piece, label, name }) => (
                <button
                  key={piece}
                  onClick={() => promote(piece)}
                  className="w-16 h-16 flex items-center justify-center text-3xl bg-[#262421] hover:bg-[#363431] border border-[#3c3934] hover:border-emerald-500 rounded-lg transition-all hover:scale-110 hover:shadow-lg hover:shadow-emerald-500/10"
                  title={name}
                >
                  <span className={piece === 'q' || piece === 'b' ? 'text-[#ffffff]' : 'text-[#ffffff]'}>{label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={cancelPromotion}
              className="w-full mt-3 py-1.5 text-[10px] font-bold text-[#615e59] hover:text-[#bababa] uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
          </div>
            </div>
          )}
      {showHint && lastMoveQuality && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl p-6 shadow-2xl max-w-md w-full mx-4">
            <div className={`text-3xl font-black text-center mb-2 ${MOVE_QUALITY_STYLES[lastMoveQuality.type].text}`}>
              {lastMoveQuality.symbol}
            </div>
            <p className={`text-center text-lg font-bold mb-1 ${MOVE_QUALITY_STYLES[lastMoveQuality.type].text}`}>
              {lastMoveQuality.label}!
            </p>
            <p className="text-center text-sm text-[#bababa] mb-5">
              Your move dropped the evaluation by {(lastMoveQuality.centipawnLoss / 100).toFixed(1)} pawns.
              {lastMoveQuality.type === 'blunder' ? ' Look for a safer square or tactical defense.' : ' Review the position carefully.'}
            </p>
            <div className="flex gap-2">
              <button onClick={hintUndo} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded transition-colors uppercase tracking-wider">
                <Undo2 size={14} className="inline mr-1.5" /> Undo Move
              </button>
              <button onClick={acknowledgeHint} className="flex-1 py-2.5 bg-[#262421] hover:bg-[#363431] text-[#bababa] text-xs font-bold rounded border border-[#3c3934] transition-colors uppercase tracking-wider">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .minimal-scrollbar::-webkit-scrollbar { width: 4px; }
        .minimal-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .minimal-scrollbar::-webkit-scrollbar-thumb { background: #3c3934; border-radius: 2px; }
        .minimal-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a4640; }
      `}</style>
    </main>
  );
}


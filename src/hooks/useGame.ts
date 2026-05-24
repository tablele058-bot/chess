'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Chess, type Square } from 'chess.js';
import { useEngineManager, getBookMove, shouldBlunder, getEngineConfig } from './useEngineManager';
import { playSound } from '@/lib/sounds';

export interface BoardTheme {
  name: string;
  light: string;
  dark: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { name: 'Classic Wood', light: '#eeeed2', dark: '#769656' },
  { name: 'Blue Marble', light: '#dee3e6', dark: '#8ca2ad' },
  { name: 'Dark Mode', light: '#b58863', dark: '#4a4a4a' },
  { name: 'Ice Court', light: '#e8edf3', dark: '#7d9db5' },
  { name: 'Mahogany', light: '#f0d9b5', dark: '#b5583a' },
];

export interface MoveQuality {
  type: 'brilliant' | 'excellent' | 'best' | 'inaccuracy' | 'mistake' | 'blunder';
  symbol: string;
  label: string;
  centipawnLoss: number;
}

export interface AiLevel {
  label: string;
  elo: number;
}

export const AI_LEVELS: AiLevel[] = [
  { label: 'Beginner', elo: 400 },
  { label: 'Casual', elo: 800 },
  { label: 'Intermediate', elo: 1200 },
  { label: 'Advanced', elo: 1600 },
  { label: 'Expert', elo: 2000 },
  { label: 'Master', elo: 2200 },
  { label: 'Grandmaster', elo: 2600 },
];

export const MOVE_QUALITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  brilliant: { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  excellent: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
  best: { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/20' },
  inaccuracy: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  mistake: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  blunder: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
};

function classifyMoveQuality(centipawnLoss: number): MoveQuality {
  if (centipawnLoss < 15) return { type: 'brilliant', symbol: '!!', label: 'Brilliant', centipawnLoss };
  if (centipawnLoss < 50) return { type: 'excellent', symbol: '!', label: 'Excellent', centipawnLoss };
  if (centipawnLoss < 100) return { type: 'best', symbol: '', label: 'Best', centipawnLoss };
  if (centipawnLoss < 200) return { type: 'inaccuracy', symbol: '?', label: 'Inaccuracy', centipawnLoss };
  if (centipawnLoss < 400) return { type: 'mistake', symbol: '??', label: 'Mistake', centipawnLoss };
  return { type: 'blunder', symbol: '???', label: 'Blunder', centipawnLoss };
}

function getRandomMove(game: Chess): string | null {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;
  const m = moves[Math.floor(Math.random() * moves.length)];
  return m.from + m.to + (m.promotion || '');
}

export function useGame() {
  const [game, setGame] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [fenHistory, setFenHistory] = useState<string[]>([game.fen()]);
  const [viewedMoveIndex, setViewedMoveIndex] = useState<number | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [botElo, setBotElo] = useState(1200);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [boardThemeIndex, setBoardThemeIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [lastMoveSquares, setLastMoveSquares] = useState<{ from: Square; to: Square } | null>(null);
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);

  const { getBestMove, setDifficultyByElo, status: engineStatus, evaluation, evaluatePosition, powerfulMode, setPowerfulMode, engineSource } = useEngineManager();

  const [isLocalMode, setIsLocalMode] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintSquares, setHintSquares] = useState<{ from: Square; to: Square } | null>(null);
  const [hintMove, setHintMove] = useState<string | null>(null);
  const [lastMoveQuality, setLastMoveQuality] = useState<MoveQuality | null>(null);
  const moveQualitiesRef = useRef<Record<number, MoveQuality>>({});
  const evalBeforeMoveRef = useRef<number | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<number, MoveQuality> | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisAbortRef = useRef(false);

  useEffect(() => {
    setDifficultyByElo(botElo);
  }, [botElo, setDifficultyByElo]);

  const toggleLocalMode = useCallback(() => {
    setIsLocalMode((prev) => !prev);
  }, []);

  const setLocalMode = useCallback((val: boolean) => {
    setIsLocalMode(val);
  }, []);

  const acknowledgeHint = useCallback(() => {
    setShowHint(false);
  }, []);

  const clearHint = useCallback(() => {
    setHintSquares(null);
    setHintMove(null);
  }, []);

  const analyzeGame = useCallback(async () => {
    const moves = game.history({ verbose: false });
    if (moves.length === 0) return;
    analysisAbortRef.current = false;
    setIsAnalyzing(true);
    const results: Record<number, MoveQuality> = {};

    for (let i = 0; i < moves.length; i++) {
      if (analysisAbortRef.current) break;

      if (moveQualitiesRef.current[i + 1]) {
        results[i + 1] = moveQualitiesRef.current[i + 1];
        setAnalysisResults({ ...results });
        continue;
      }

      const tempGame = new Chess();
      for (let j = 0; j < i; j++) {
        try { tempGame.move(moves[j]); } catch { break; }
      }
      const evalBefore = await evaluatePosition(tempGame.fen(), 4);
      try { tempGame.move(moves[i]); } catch { continue; }
      const evalAfter = await evaluatePosition(tempGame.fen(), 4);

      if (evalBefore !== null && evalAfter !== null) {
        const loss = i % 2 === 0
          ? Math.max(0, evalBefore - evalAfter)
          : Math.max(0, evalAfter - evalBefore);
        results[i + 1] = classifyMoveQuality(loss);
        moveQualitiesRef.current[i + 1] = results[i + 1];
        setAnalysisResults({ ...results });
      }
    }
    setIsAnalyzing(false);
  }, [game, evaluatePosition]);

  const clearAnalysis = useCallback(() => {
    analysisAbortRef.current = true;
    setAnalysisResults(null);
    setIsAnalyzing(false);
  }, []);

  const displayFen = viewedMoveIndex !== null && viewedMoveIndex < fenHistory.length
    ? fenHistory[viewedMoveIndex]
    : fen;

  const isViewingHistory = viewedMoveIndex !== null;

  const getMoveOptions = useCallback((square: Square) => {
    const moves = game.moves({ square, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: Record<string, React.CSSProperties> = {};
    moves.forEach((move) => {
      newSquares[move.to] = {
        background: game.get(move.to)
          ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(0,0,0,.1) 20%, transparent 20%)',
        borderRadius: '50%',
      };
    });
    setOptionSquares(newSquares);
    return true;
  }, [game]);

  const makeMove = useCallback((from: Square, to: Square, promotion?: string) => {
    try {
      const isCapture = !!game.get(to);
      const hadCheck = game.isCheck();
      const result = game.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined });
      if (result) {
        const newFen = game.fen();
        setFen(newFen);
        setMoveHistory(game.history({ verbose: false }));
        setFenHistory((prev) => [...prev, newFen]);
        setOptionSquares({});
        setSelectedSquare(null);
        setLastMoveSquares({ from, to });
        setViewedMoveIndex(null);

        if (game.isGameOver()) {
          playSound('gameOver');
        } else if (game.isCheck()) {
          playSound('check');
        } else if (isCapture) {
          playSound('capture');
        } else {
          playSound('move');
        }

        return true;
      }
    } catch {
      // invalid move
    }
    return false;
  }, [game]);

  const triggerAi = useCallback(async () => {
    if (game.isGameOver() || game.turn() !== 'b') return;
    setIsAiThinking(true);

    try {
      const uciHistory = game.history({ verbose: true }).map((m) => m.from + m.to);
      const bookMove = getBookMove(uciHistory);

      if (bookMove) {
        makeMove(
          bookMove.slice(0, 2) as Square,
          bookMove.slice(2, 4) as Square,
          bookMove.slice(4) || undefined
        );
      } else {
        const config = getEngineConfig(botElo);
        let aiMove = await getBestMove(game.fen(), {
          depth: config.depth,
          movetime: config.useMovetime ? config.movetime : undefined,
        });

        if (!aiMove) {
          aiMove = getRandomMove(game);
        }

        if (aiMove) {
          const finalMove = shouldBlunder(config.blunderRate) ? getRandomMove(game) ?? aiMove : aiMove;
          makeMove(
            finalMove.slice(0, 2) as Square,
            finalMove.slice(2, 4) as Square,
            finalMove.slice(4) || undefined
          );
        }
      }
    } catch (err) {
      console.error('AI error:', err);
    } finally {
      setIsAiThinking(false);
    }
  }, [game, getBestMove, makeMove, botElo]);

  useEffect(() => {
    if (isLocalMode) return;
    if (game.turn() === 'b' && !game.isGameOver()) {
      const timer = setTimeout(() => triggerAi(), 300);
      return () => clearTimeout(timer);
    }
  }, [fen, triggerAi, game, isLocalMode]);

  useEffect(() => {
    if (!isLocalMode) return;
    setIsFlipped(game.turn() === 'b');
  }, [game.turn(), isLocalMode]);

  const isPromotionMove = useCallback((from: Square, to: Square) => {
    const piece = game.get(from);
    if (!piece || piece.type !== 'p') return false;
    return to[1] === '1' || to[1] === '8';
  }, [game]);

  const classifyLastMove = useCallback(async (showPopup = true) => {
    const evalBefore = evalBeforeMoveRef.current;
    if (evalBefore === null) return;
    const currentFen = game.fen();
    const newEval = await evaluatePosition(currentFen, 8);
    if (newEval === null) return;
    const loss = Math.max(0, evalBefore - newEval);
    const quality = classifyMoveQuality(loss);
    const moveIdx = game.history({ verbose: false }).length;
    moveQualitiesRef.current[moveIdx] = quality;
    setLastMoveQuality(quality);
    if (showPopup && (quality.type === 'blunder' || quality.type === 'mistake')) {
      setShowHint(true);
    }
  }, [game, evaluatePosition]);

  const requestHint = useCallback(async () => {
    if (isAiThinking) return;
    setIsAiThinking(true);
    const move = await getBestMove(game.fen(), { depth: 12, movetime: 1000 });
    if (move && move.length >= 4) {
      const from = move.slice(0, 2) as Square;
      const to = move.slice(2, 4) as Square;
      const promotion = move.slice(4) as 'q' | 'r' | 'b' | 'n' | undefined;
      if (promotion) {
        setPromotionPending({ from, to });
      } else {
        makeMove(from, to, promotion);
      }
    }
    setIsAiThinking(false);
  }, [game, getBestMove, isAiThinking, makeMove]);

  const onSquareClick = useCallback((squareStr: string) => {
    const sq = squareStr as Square;
    if (game.isGameOver() || isAiThinking) return;
    if (!isLocalMode && game.turn() !== 'w') return;
    if (promotionPending) return;

    if (isViewingHistory) {
      setViewedMoveIndex(null);
    }

    if (!selectedSquare) {
      const hasOptions = getMoveOptions(sq);
      if (hasOptions) setSelectedSquare(sq);
    } else {
      evalBeforeMoveRef.current = evaluation;
      if (isPromotionMove(selectedSquare, sq)) {
        setPromotionPending({ from: selectedSquare, to: sq });
        setOptionSquares({});
        setSelectedSquare(null);
        return;
      }
      const success = makeMove(selectedSquare, sq);
      if (success) {
        if (isLocalMode) {
          setTimeout(() => classifyLastMove(false), 600);
        } else {
          setTimeout(() => classifyLastMove(), 600);
        }
      } else {
        const hasOptions = getMoveOptions(sq);
        if (hasOptions) {
          setSelectedSquare(sq);
        } else {
          setSelectedSquare(null);
          setOptionSquares({});
        }
      }
    }
  }, [selectedSquare, game, getMoveOptions, makeMove, isAiThinking, isViewingHistory, isPromotionMove, evaluation, isLocalMode, classifyLastMove, promotionPending]);

  const promote = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (!promotionPending) return;
    makeMove(promotionPending.from, promotionPending.to, piece);
    setPromotionPending(null);
  }, [promotionPending, makeMove]);

  const cancelPromotion = useCallback(() => {
    setPromotionPending(null);
  }, []);

  const undoMove = useCallback(() => {
    if (game.history().length === 0 || isAiThinking) return;

    if (!isLocalMode && game.turn() === 'w') {
      game.undo();
      game.undo();
    } else {
      game.undo();
    }

    setFen(game.fen());
    setMoveHistory(game.history({ verbose: false }));
    setFenHistory((prev) => {
      const updated = [...prev];
      const targetLen = game.history().length + 1;
      return updated.slice(0, targetLen);
    });
    setSelectedSquare(null);
    setOptionSquares({});
    setViewedMoveIndex(null);

    const hist = game.history({ verbose: true });
    if (hist.length >= 1) {
      const last = hist[hist.length - 1];
      setLastMoveSquares({ from: last.from as Square, to: last.to as Square });
    } else {
      setLastMoveSquares(null);
    }
  }, [game, isAiThinking, isLocalMode]);

  const hintUndo = useCallback(() => {
    setShowHint(false);
    undoMove();
  }, [undoMove]);

  const resetGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    const initialFen = newGame.fen();
    setFen(initialFen);
    setMoveHistory([]);
    setFenHistory([initialFen]);
    setSelectedSquare(null);
    setOptionSquares({});
    setLastMoveSquares(null);
    setViewedMoveIndex(null);
    setShowHint(false);
    setLastMoveQuality(null);
    setHintSquares(null);
    setHintMove(null);
    setPromotionPending(null);
    moveQualitiesRef.current = {};
    evalBeforeMoveRef.current = null;
    analysisAbortRef.current = true;
    setAnalysisResults(null);
    setIsAnalyzing(false);
    playSound('gameStart');
  }, []);

  const flipBoard = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const selectLevel = useCallback((elo: number) => {
    setBotElo(elo);
  }, []);

  const goToStart = useCallback(() => {
    setViewedMoveIndex(0);
  }, []);

  const goBack = useCallback(() => {
    setViewedMoveIndex((prev) => {
      if (prev === null) {
        return Math.max(0, fenHistory.length - 2);
      }
      return Math.max(0, prev - 1);
    });
  }, [fenHistory.length]);

  const goForward = useCallback(() => {
    setViewedMoveIndex((prev) => {
      if (prev === null) return null;
      const next = prev + 1;
      return next >= fenHistory.length - 1 ? null : next;
    });
  }, [fenHistory.length]);

  const goToLive = useCallback(() => {
    setViewedMoveIndex(null);
  }, []);

  const jumpToMove = useCallback((index: number) => {
    if (index < 0 || index >= fenHistory.length) return;
    setViewedMoveIndex(index);
    setSelectedSquare(null);
    setOptionSquares({});
  }, [fenHistory.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        goToLive();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goBack, goForward, goToLive]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (lastMoveSquares && !selectedSquare) {
      styles[lastMoveSquares.from] = {
        backgroundColor: 'rgba(255, 255, 0, 0.2)',
      };
      styles[lastMoveSquares.to] = {
        backgroundColor: 'rgba(255, 255, 0, 0.35)',
      };
    }

    if (hintSquares) {
      styles[hintSquares.from] = {
        backgroundColor: 'rgba(16, 185, 129, 0.25)',
        boxShadow: 'inset 0 0 12px rgba(16, 185, 129, 0.4)',
      };
      styles[hintSquares.to] = {
        backgroundColor: 'rgba(16, 185, 129, 0.4)',
        boxShadow: 'inset 0 0 12px rgba(16, 185, 129, 0.5)',
      };
    }

    Object.assign(styles, optionSquares);

    return styles;
  }, [lastMoveSquares, optionSquares, selectedSquare, hintSquares]);

  const loadGameHistory = useCallback((moves: string[]) => {
    const newGame = new Chess();
    const newFenHistory = [newGame.fen()];

    for (const move of moves) {
      try {
        newGame.move(move);
        newFenHistory.push(newGame.fen());
      } catch {
        break;
      }
    }

    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory(newGame.history({ verbose: false }));
    setFenHistory(newFenHistory);
    setViewedMoveIndex(0);
    setSelectedSquare(null);
    setOptionSquares({});
    setLastMoveSquares(null);
  }, []);

  const isGameOver = game.isGameOver();
  const status = game.isCheckmate() ? 'Checkmate!'
    : game.isDraw() ? 'Draw'
    : game.isStalemate() ? 'Stalemate'
    : isGameOver ? 'Game Over'
    : 'In Progress';

  return {
    fen: displayFen,
    liveFen: fen,
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
    isGameOver,
    status,
    undoMove,
    isFlipped,
    flipBoard,
    boardTheme: BOARD_THEMES[boardThemeIndex],
    boardThemeIndex,
    setBoardThemeIndex,
    lastMoveSquares,
    turn: game.turn(),
    selectLevel,
    viewedMoveIndex,
    isViewingHistory,
    goToStart,
    goBack,
    goForward,
    goToLive,
    arePiecesDraggable: !isViewingHistory,
    jumpToMove,
    loadGameHistory,
    promotionPending,
    promote,
    cancelPromotion,
    lastMoveQuality,
    showHint,
    acknowledgeHint,
    hintUndo,
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
  };
}

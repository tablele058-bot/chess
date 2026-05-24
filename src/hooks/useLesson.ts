'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess, type Square } from 'chess.js';
import { LESSONS } from '@/data/lessons';

export type LessonPhase = 'instruction' | 'demo' | 'puzzle' | 'sparring';

export function useLesson() {
  const [lessonIndex, setLessonIndex] = useState(0);
  const [phase, setPhase] = useState<LessonPhase>('instruction');
  const [game, setGame] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [puzzleState, setPuzzleState] = useState<'none' | 'success' | 'fail'>('none');
  const [demoStep, setDemoStep] = useState(0);
  const [message, setMessage] = useState('');
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const demoPlayingRef = useRef(false);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentLesson = LESSONS[lessonIndex];

  useEffect(() => {
    const saved = localStorage.getItem('sujana_chess_completed_lessons');
    if (saved) setCompletedLessons(new Set(JSON.parse(saved)));
  }, []);

  useEffect(() => {
    localStorage.setItem('sujana_chess_completed_lessons', JSON.stringify([...completedLessons]));
  }, [completedLessons]);

  const loadPosition = useCallback((fenStr: string) => {
    const newGame = new Chess(fenStr);
    setGame(newGame);
    setFen(newGame.fen());
    setSelectedSquare(null);
    setOptionSquares({});
  }, []);

  const goToLesson = useCallback((idx: number) => {
    if (idx < 0 || idx >= LESSONS.length) return;
    setLessonIndex(idx);
    setPhase('instruction');
    setPuzzleState('none');
    setDemoStep(0);
    setMessage('');
    demoPlayingRef.current = false;
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    loadPosition(LESSONS[idx].demoFen);
  }, [loadPosition]);

  const instruction = useCallback(() => {
    setPhase('instruction');
    setPuzzleState('none');
    setDemoStep(0);
    setMessage('');
    loadPosition(currentLesson.demoFen);
  }, [currentLesson.demoFen, loadPosition]);

  const startDemo = useCallback(() => {
    loadPosition(currentLesson.demoFen);
    setDemoStep(0);
    setPhase('demo');
    setMessage('');
  }, [currentLesson.demoFen, loadPosition]);

  const advanceDemo = useCallback(() => {
    if (demoStep >= currentLesson.demoMoves.length) return;
    const move = currentLesson.demoMoves[demoStep];
    try {
      game.move(move);
      setFen(game.fen());
      setDemoStep((s) => s + 1);
      setSelectedSquare(null);
      setOptionSquares({});
    } catch {}
  }, [demoStep, currentLesson.demoMoves, game]);

  const playAllDemo = useCallback(() => {
    if (demoPlayingRef.current) return;
    demoPlayingRef.current = true;
    const newGame = new Chess(currentLesson.demoFen);
    setGame(newGame);
    setFen(newGame.fen());
    setDemoStep(0);

    let step = 0;
    const playNext = () => {
      if (step >= currentLesson.demoMoves.length) {
        demoPlayingRef.current = false;
        return;
      }
      try {
        newGame.move(currentLesson.demoMoves[step]);
        setFen(newGame.fen());
        setDemoStep(step + 1);
        step++;
        demoTimerRef.current = setTimeout(playNext, 800);
      } catch {
        demoPlayingRef.current = false;
      }
    };
    playNext();
  }, [currentLesson.demoFen, currentLesson.demoMoves]);

  const resetDemo = useCallback(() => {
    demoPlayingRef.current = false;
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    loadPosition(currentLesson.demoFen);
    setDemoStep(0);
  }, [currentLesson.demoFen, loadPosition]);

  const startPuzzle = useCallback(() => {
    loadPosition(currentLesson.puzzleFen);
    setPuzzleState('none');
    setPhase('puzzle');
    setMessage(currentLesson.puzzleHint);
  }, [currentLesson.puzzleFen, currentLesson.puzzleHint, loadPosition]);

  const startSparring = useCallback(() => {
    const sparFen = currentLesson.sparringFen || currentLesson.demoFen;
    loadPosition(sparFen);
    setPhase('sparring');
    setMessage(currentLesson.sparringInstruction || 'Play from this position against the AI.');
  }, [currentLesson, loadPosition]);

  const prevLesson = useCallback(() => goToLesson(lessonIndex - 1), [lessonIndex, goToLesson]);
  const nextLesson = useCallback(() => goToLesson(lessonIndex + 1), [lessonIndex, goToLesson]);

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

  const onSquareClick = useCallback((squareStr: string) => {
    if (phase !== 'puzzle') return;
    if (puzzleState === 'success') return;
    setMessage('');

    const sq = squareStr as Square;

    if (!selectedSquare) {
      const hasOptions = getMoveOptions(sq);
      if (hasOptions) setSelectedSquare(sq);
    } else {
      try {
        game.move({ from: selectedSquare, to: sq, promotion: 'q' });
        const newFen = game.fen();
        setFen(newFen);
        setOptionSquares({});
        setSelectedSquare(null);

        const lastMove = game.history({ verbose: false }).pop() || '';
        const expected = currentLesson.puzzleSolution;

        if (lastMove === expected || lastMove.startsWith(expected.split('=')[0])) {
          setPuzzleState('success');
          setMessage(currentLesson.successText);
          const newSet = new Set(completedLessons);
          newSet.add(currentLesson.id);
          setCompletedLessons(newSet);
        } else {
          setPuzzleState('fail');
          setMessage('Not quite. Try again — ' + currentLesson.puzzleHint);
        }
      } catch {
        setSelectedSquare(null);
        setOptionSquares({});
      }
    }
  }, [phase, puzzleState, selectedSquare, game, getMoveOptions, currentLesson, completedLessons]);

  const retryPuzzle = useCallback(() => {
    loadPosition(currentLesson.puzzleFen);
    setPuzzleState('none');
    setMessage(currentLesson.puzzleHint);
  }, [currentLesson.puzzleFen, currentLesson.puzzleHint, loadPosition]);

  const onSparringSquareClick = useCallback((squareStr: string) => {
    if (phase !== 'sparring') return;
    const sq = squareStr as Square;
    if (!selectedSquare) {
      const hasOptions = getMoveOptions(sq);
      if (hasOptions) setSelectedSquare(sq);
    } else {
      try {
        game.move({ from: selectedSquare, to: sq, promotion: 'q' });
        setFen(game.fen());
        setOptionSquares({});
        setSelectedSquare(null);
      } catch {
        const hasOptions = getMoveOptions(sq);
        if (hasOptions) setSelectedSquare(sq);
        else { setSelectedSquare(null); setOptionSquares({}); }
      }
    }
  }, [phase, selectedSquare, game, getMoveOptions]);

  const resetBoard = useCallback(() => {
    loadPosition(currentLesson.demoFen);
    setPhase('instruction');
    setPuzzleState('none');
    setDemoStep(0);
    setMessage('');
  }, [currentLesson.demoFen, loadPosition]);

  return {
    lessonIndex,
    currentLesson,
    phase,
    fen,
    game,
    selectedSquare,
    optionSquares,
    puzzleState,
    demoStep,
    message,
    completedLessons,
    goToLesson,
    instruction,
    startDemo,
    advanceDemo,
    playAllDemo,
    resetDemo,
    startPuzzle,
    startSparring,
    onSquareClick,
    retryPuzzle,
    onSparringSquareClick,
    prevLesson,
    nextLesson,
    resetBoard,
    totalLessons: LESSONS.length,
  };
}

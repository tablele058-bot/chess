'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

export type EngineSource = 'local' | 'cloud';
export type EngineStatus = 'loading' | 'ready' | 'thinking' | 'error';

export interface EngineConfig {
  skillLevel: number;
  blunderRate: number;
  depth: number;
  useMovetime: boolean;
  movetime: number;
}

const OPENING_BOOK: string[][] = [
  ['e2e4', 'e7e5'], ['e2e4', 'e7e5', 'g1f3', 'b8c6'], ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'], ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4'],
  ['e2e4', 'e7e5', 'g1f3', 'g8f6'], ['e2e4', 'e7e5', 'g1f3', 'd7d6'],
  ['e2e4', 'e7e5', 'f1c4', 'g8f6'], ['e2e4', 'e7e5', 'b1c3', 'b8c6'],
  ['e2e4', 'e7e5', 'g1f3', 'f8c5'], ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'c2c3'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3'],

  ['e2e4', 'c7c5'], ['e2e4', 'c7c5', 'g1f3', 'd7d6'], ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'],
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'e7e6'],
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'b8c6'],
  ['e2e4', 'c7c5', 'g1f3', 'e7e6'], ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4', 'b8c6'],
  ['e2e4', 'c7c5', 'g1f3', 'b8c6'], ['e2e4', 'c7c5', 'c2c3'],
  ['e2e4', 'c7c5', 'b1c3', 'b8c6'], ['e2e4', 'c7c5', 'f2f4'],
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'g7g6'],
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'f1b5', 'c8d7'],

  ['e2e4', 'e7e6'], ['e2e4', 'e7e6', 'd2d4', 'd7d5'], ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1d2', 'c7c5'], ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'e4e5', 'c7c5', 'c2c3'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'f8b4'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'e4e5', 'c7c5', 'c2c3', 'b8c6', 'g1f3', 'd8b6'],

  ['e2e4', 'c7c6'], ['e2e4', 'c7c6', 'd2d4', 'd7d5'], ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5', 'c8f5'],
  ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4'],
  ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4d5', 'c6d5', 'c2c4'],

  ['e2e4', 'd7d6'], ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6'],
  ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'e7e5'],
  ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'f1e2', 'g7g6'],
  ['e2e4', 'd7d6', 'g1f3', 'g8f6', 'b1c3', 'g7g6', 'd2d4', 'f8g7'],

  ['e2e4', 'g8f6'], ['e2e4', 'g8f6', 'e4e5', 'f6d5'],
  ['e2e4', 'g8f6', 'b1c3', 'd7d5'], ['e2e4', 'g8f6', 'e4e5', 'f6d5', 'c2c4', 'd5b6', 'd2d4'],

  ['e2e4', 'd7d5'], ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5'],
  ['e2e4', 'd7d5', 'e4d5', 'g8f6'],

  ['e2e4', 'b8c6'], ['e2e4', 'g7g6'], ['e2e4', 'a7a6'],
  ['e2e4', 'f7f5'],

  ['d2d4', 'd7d5'], ['d2d4', 'd7d5', 'c2c4', 'e7e6'], ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6'],
  ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'c7c5'],
  ['d2d4', 'd7d5', 'c2c4', 'c7c6'], ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6'],
  ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'b1c3', 'd5c4', 'a2a4', 'c8f5'],
  ['d2d4', 'd7d5', 'c2c4', 'e7e5'], ['d2d4', 'd7d5', 'c2c4', 'd5c4'],
  ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'c2c4', 'e7e6'],
  ['d2d4', 'd7d5', 'c1f4', 'g8f6'], ['d2d4', 'd7d5', 'e2e3'],
  ['d2d4', 'd7d5', 'b1c3', 'g8f6'], ['d2d4', 'd7d5', 'c2c4', 'g8f6', 'c4d5', 'f6d5'],

  ['d2d4', 'g8f6'], ['d2d4', 'g8f6', 'c2c4', 'g7g6'], ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7'],
  ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6'], ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'b7b6'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'd7d5'],
  ['d2d4', 'g8f6', 'c2c4', 'c7c5'], ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'e7e6'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e5'], ['d2d4', 'g8f6', 'g1f3', 'e7e6'],
  ['d2d4', 'g8f6', 'c1g5', 'e7e6'], ['d2d4', 'g8f6', 'b1c3', 'd7d5'],
  ['d2d4', 'g8f6', 'g1f3', 'g7g6'], ['d2d4', 'g8f6', 'g1f3', 'd7d5'],

  ['d2d4', 'e7e6'], ['d2d4', 'f7f5'],
  ['d2d4', 'b8c6'], ['d2d4', 'd7d6'], ['d2d4', 'c7c5'],

  ['g1f3', 'd7d5'], ['g1f3', 'g8f6'], ['g1f3', 'c7c5'],
  ['g1f3', 'g7g6'], ['g1f3', 'e7e6'],

  ['c2c4', 'e7e5'], ['c2c4', 'g8f6'], ['c2c4', 'c7c5'],
  ['c2c4', 'e7e6'], ['c2c4', 'f7f5'],

  ['b1c3', 'd7d5'], ['b1c3', 'g8f6'],
  ['e2e3', 'd7d5'], ['e2e3', 'e7e5'],

  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'd8e7', 'd2d4', 'c5b6'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'b1c3', 'g8f6', 'd2d3', 'd7d6'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1h1'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6', 'e1h1', 'f8c5', 'f3e5'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'f8c5', 'c2c3', 'g8e7', 'd2d4', 'c5b6'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4', 'f8c5', 'd4b3', 'c5b6'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1e2', 'g8f6', 'e2e5'],
  ['e2e4', 'e7e5', 'g1f3', 'g8f6', 'f3e5', 'd7d6', 'e5f3', 'f6e4', 'd2d3', 'e4f6'],

  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'c1e3', 'e7e6'],
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'f1e2', 'e7e5'],
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'b8c6', 'f1c4'],
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'g7g6', 'c1e3', 'f8g7'],
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'e7e6', 'f1e2', 'f8e7'],
  ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4', 'b8c6', 'b1c3', 'd8c7'],
  ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'e7e5', 'd4b5', 'd7d6'],
  ['e2e4', 'c7c5', 'c2c3', 'g8f6', 'e4e5', 'f6d5', 'd2d4', 'c5d4', 'c3d4', 'd7d6'],

  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'f8b4', 'e4e5', 'c7c5', 'a2a3', 'b4c3'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'e4e5', 'f6d7', 'f1e2', 'c7c5'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1d2', 'c7c5', 'e4d5', 'e6d5', 'f1b5', 'c8d7'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1d2', 'g8f6', 'e4e5', 'f6d7', 'c2c3', 'c7c5'],

  ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7'],
  ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'f8b4'],
  ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'c7c6'],
  ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'g1f3', 'g8f6', 'b1c3', 'f8e7', 'c1f4'],
  ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'b1c3', 'e7e6'],
  ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'e2e3', 'e7e6'],
  ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'c4d5', 'c6d5', 'b1c3', 'b8c6'],
  ['d2d4', 'd7d5', 'c2c4', 'd5c4', 'e2e3', 'e7e5', 'f1c4', 'e5d4', 'e3d4'],

  ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6'],
  ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5', 'c4d5', 'f6d5'],
  ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'g1f3', 'd7d6'],
  ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'f1e2', 'e8g8'],
  ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'c1g5'],
  ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'c7c5'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'e2e3', 'c7c5'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'b7b6', 'a2a3', 'c8b7'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'f8b4', 'c1d2', 'd8e7'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'd7d5', 'b1c3', 'f8e7'],
  ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'e7e6', 'b1c3', 'e6d5', 'c4d5', 'd7d6'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e5', 'd4e5', 'f6g4', 'c1f4', 'b8c6'],
];

export function getEngineConfig(elo: number): EngineConfig {
  if (elo < 600) {
    return { skillLevel: 1, blunderRate: 0.35, depth: 3, useMovetime: true, movetime: 80 };
  }
  if (elo < 1000) {
    const t = (elo - 600) / 400;
    return {
      skillLevel: Math.round(3 + t * 2),
      blunderRate: +(0.20 * (1 - t)).toFixed(3),
      depth: Math.round(4 + t * 1),
      useMovetime: true,
      movetime: 100,
    };
  }
  if (elo < 1600) {
    const t = (elo - 1000) / 600;
    return {
      skillLevel: Math.round(5 + t * 5),
      blunderRate: +(0.10 * (1 - t)).toFixed(3),
      depth: Math.round(5 + t * 2),
      useMovetime: true,
      movetime: Math.round(120 + t * 80),
    };
  }
  if (elo < 2200) {
    const t = (elo - 1600) / 600;
    return {
      skillLevel: Math.round(10 + t * 8),
      blunderRate: +(0.04 * (1 - t)).toFixed(3),
      depth: Math.round(7 + t * 2),
      useMovetime: true,
      movetime: Math.round(200 + t * 150),
    };
  }
  const t = (elo - 2200) / 400;
  return {
    skillLevel: Math.round(18 + t * 2),
    blunderRate: +(0.01 * (1 - t)).toFixed(3),
    depth: Math.round(9 + t * 3),
    useMovetime: true,
    movetime: Math.round(350 + t * 150),
  };
}

export function getBookMove(uciHistory: string[]): string | null {
  const blackMoveCount = Math.floor(uciHistory.length / 2);
  if (blackMoveCount >= 3) return null;

  const matches = OPENING_BOOK.filter((opening) => {
    if (opening.length <= uciHistory.length) return false;
    return uciHistory.every((move, i) => opening[i] === move);
  });

  if (matches.length === 0) return null;
  const selected = matches[Math.floor(Math.random() * matches.length)];
  return selected[uciHistory.length];
}

export function shouldBlunder(rate: number): boolean {
  if (rate <= 0) return false;
  return Math.random() < rate;
}

// ----- Server Engine API (Powerful Mode) -----

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

async function queryServerEval(fen: string, options?: { depth?: number; movetime?: number }): Promise<{
  bestMove: string | null;
  evalCp: number | null;
}> {
  try {
    const res = await fetch(`${SERVER_URL}/api/engine/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, depth: options?.depth, movetime: options?.movetime }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { bestMove: null, evalCp: null };
    const body = await res.json();
    return {
      bestMove: body.bestMove ?? null,
      evalCp: body.evalCp ?? null,
    };
  } catch {
    return { bestMove: null, evalCp: null };
  }
}

async function queryServerEvalOnly(fen: string, depth?: number): Promise<number | null> {
  try {
    const res = await fetch(`${SERVER_URL}/api/engine/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, depth }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.evalCp ?? null;
  } catch {
    return null;
  }
}

// ----- Worker management -----

const SEARCH_TIMEOUT_BUF = 5000;
const MAX_SEARCHES_BEFORE_RESTART = 100;

function createWorker(
  onReady: () => void,
  onStdout: (data: string) => void,
  onError: (msg: string) => void,
  onWorkerError: (err: Event) => void,
): Worker {
  const worker = new Worker('/stockfish/worker.js', { type: 'module' });

  worker.onmessage = (e) => {
    const { type, data } = e.data;
    if (type === 'ready') onReady();
    else if (type === 'stdout') onStdout(data);
    else if (type === 'error') onError(data);
  };

  worker.onerror = onWorkerError;
  worker.postMessage({ type: 'init' });
  return worker;
}

export interface UseEngineManagerReturn {
  status: EngineStatus;
  evaluation: number | null;
  isCalculating: boolean;
  engineSource: EngineSource;
  cloudEval: number | null;
  powerfulMode: boolean;
  setPowerfulMode: (v: boolean) => void;
  setSkillLevel: (level: number) => void;
  setDifficultyByElo: (elo: number) => void;
  getBestMove: (fen: string, options?: { depth?: number; movetime?: number; powerful?: boolean }) => Promise<string | null>;
  evaluatePosition: (fen: string, depth: number) => Promise<number | null>;
  sendCommand: (cmd: string) => void;
  restartWorker: () => void;
}

export function useEngineManager(): UseEngineManagerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<EngineStatus>('loading');
  const [evaluation, setEvaluation] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [engineSource, setEngineSource] = useState<EngineSource>('local');
  const [cloudEval, setCloudEval] = useState<number | null>(null);
  const [powerfulMode, setPowerfulMode] = useState(false);

  const resolveRef = useRef<((move: string | null) => void) | null>(null);
  const statusRef = useRef<EngineStatus>('loading');
  const fenRef = useRef<string>('');
  const evalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const searchCountRef = useRef(0);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skillLevelRef = useRef(1);
  const localEvalRef = useRef<number | null>(null);

  const sendCommand = (command: string) => {
    workerRef.current?.postMessage({ type: 'uci', payload: command });
  };

  const startWorker = useCallback(() => {
    const onReady = () => {
      if (!mountedRef.current) return;
      statusRef.current = 'ready';
      setStatus('ready');
      sendCommand(`setoption name Skill Level value ${skillLevelRef.current}`);
    };

    const onStdout = (data: string) => {
      if (!mountedRef.current) return;
      if (data.startsWith('bestmove')) {
        if (pendingTimeoutRef.current) {
          clearTimeout(pendingTimeoutRef.current);
          pendingTimeoutRef.current = null;
        }
        const parts = data.split(' ');
        const move = parts[1] === '(none)' ? null : parts[1];
        if (resolveRef.current) {
          resolveRef.current(move);
          resolveRef.current = null;
        }
        statusRef.current = 'ready';
        setStatus('ready');
        setIsCalculating(false);
      } else if (data.startsWith('info')) {
        const cpMatch = data.match(/score cp (-?\d+)/);
        if (cpMatch) {
          const raw = parseInt(cpMatch[1], 10);
          const turn = fenRef.current.split(' ')[1];
          const fromWhitePerspective = turn === 'b' ? -raw : raw;
          evalRef.current = fromWhitePerspective;
          localEvalRef.current = fromWhitePerspective;
          setEvaluation(fromWhitePerspective);
        }
        const mateMatch = data.match(/score mate (-?\d+)/);
        if (mateMatch) {
          const mateIn = parseInt(mateMatch[1], 10);
          const turn = fenRef.current.split(' ')[1];
          const val = mateIn > 0 ? 100000 + mateIn : -(100000 + Math.abs(mateIn));
          const adjusted = turn === 'b' ? -val : val;
          evalRef.current = adjusted;
          localEvalRef.current = adjusted;
          setEvaluation(adjusted);
        }
      }
    };

    const onError = (msg: string) => {
      if (!mountedRef.current) return;
      console.error('[Engine]', msg);
      statusRef.current = 'error';
      setStatus('error');
    };

    const onWorkerError = (err: Event) => {
      if (!mountedRef.current) return;
      console.error('[Worker]', err);
      statusRef.current = 'error';
      setStatus('error');
    };

    if (workerRef.current) workerRef.current.terminate();
    workerRef.current = createWorker(onReady, onStdout, onError, onWorkerError);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    startWorker();
    return () => {
      mountedRef.current = false;
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      if (workerRef.current) workerRef.current.terminate();
    };
  }, [startWorker]);

  const restartWorker = useCallback(() => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    if (resolveRef.current) {
      resolveRef.current(null);
      resolveRef.current = null;
    }
    statusRef.current = 'loading';
    setStatus('loading');
    evalRef.current = null;
    localEvalRef.current = null;
    setEvaluation(null);
    setIsCalculating(false);
    searchCountRef.current = 0;
    startWorker();
  }, [startWorker]);

  const setSkillLevel = useCallback(
    (level: number) => {
      skillLevelRef.current = level;
      sendCommand(`setoption name Skill Level value ${Math.round(level)}`);
    },
    []
  );

  const setDifficultyByElo = useCallback(
    (elo: number) => {
      const config = getEngineConfig(elo);
      setSkillLevel(config.skillLevel);
    },
    [setSkillLevel]
  );

  const localGetBestMove = useCallback(
    (fen: string, options: { depth?: number; movetime?: number }): Promise<string | null> => {
      return new Promise((resolve) => {
        if (statusRef.current !== 'ready') {
          resolve(null);
          return;
        }

        const timeout = (options.movetime ?? 2000) + SEARCH_TIMEOUT_BUF;

        if (searchCountRef.current >= MAX_SEARCHES_BEFORE_RESTART) {
          restartWorker();
          setTimeout(() => resolve(null), 0);
          return;
        }
        searchCountRef.current += 1;

        fenRef.current = fen;
        resolveRef.current = resolve;
        evalRef.current = null;
        localEvalRef.current = null;
        setEvaluation(null);
        statusRef.current = 'thinking';
        setStatus('thinking');
        setIsCalculating(true);
        setEngineSource('local');

        pendingTimeoutRef.current = setTimeout(() => {
          if (resolveRef.current === resolve) {
            resolve(null);
            resolveRef.current = null;
            restartWorker();
          }
        }, timeout);

        sendCommand(`position fen ${fen}`);
        const depth = options.depth ?? 10;
        if (options.movetime && options.movetime > 0) {
          sendCommand(`go depth ${depth} movetime ${options.movetime}`);
        } else {
          sendCommand(`go depth ${depth}`);
        }
      });
    },
    [restartWorker]
  );

  const getBestMove = useCallback(
    async (fen: string, options?: { depth?: number; movetime?: number; powerful?: boolean }): Promise<string | null> => {
      const depth = options?.depth ?? 10;
      const movetime = options?.movetime ?? 500;
      const usePowerful = options?.powerful ?? powerfulMode;

      if (!usePowerful) {
        return localGetBestMove(fen, { depth, movetime });
      }

      setIsCalculating(true);

      // Fire both server and local in parallel; server wins if it responds first
      const localPromise = localGetBestMove(fen, { depth, movetime });
      const serverResult = await queryServerEval(fen, { depth: 30, movetime: 3000 });

      if (serverResult.bestMove && serverResult.evalCp !== null) {
        setEngineSource('cloud');
        setCloudEval(serverResult.evalCp);
        setEvaluation(serverResult.evalCp);
        setIsCalculating(false);
        return serverResult.bestMove;
      }

      const localMove = await localPromise;
      return localMove;
    },
    [localGetBestMove, powerfulMode]
  );

  const evaluatePosition = useCallback(
    async (fen: string, depth: number): Promise<number | null> => {
      if (powerfulMode) {
        setEngineSource('cloud');
        const evalCp = await queryServerEvalOnly(fen, 24);
        if (evalCp !== null) {
          setCloudEval(evalCp);
          setEvaluation(evalCp);
          return evalCp;
        }
      }

      setEngineSource('local');
      const move = await localGetBestMove(fen, { depth, movetime: 500 });
      if (move === null) return null;
      return evalRef.current;
    },
    [localGetBestMove, powerfulMode]
  );

  return {
    status,
    evaluation,
    isCalculating,
    engineSource,
    cloudEval,
    powerfulMode,
    setPowerfulMode,
    setSkillLevel,
    setDifficultyByElo,
    getBestMove,
    evaluatePosition,
    sendCommand,
    restartWorker,
  };
}

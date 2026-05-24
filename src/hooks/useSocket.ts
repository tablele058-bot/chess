'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

export interface ServerGameState {
  gameId: string;
  boardFen: string;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  turnIndex: number;
  isBotGame: boolean;
  botElo: number;
  moveHistory: { san: string; uci: string; fen: string; from: string; to: string }[];
  status: string;
  result: string | null;
}

export function useSocket(userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<ServerGameState | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      query: { userId: userId || `web-${Math.random().toString(36).slice(2, 8)}` },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connected', (data) => {
      console.log('[Socket] Connected as', data.userId);
    });

    socket.on('moveApplied', (data) => {
      setGameState(data.state);
    });

    socket.on('illegalMove', (data) => {
      console.warn('[Socket] Illegal move:', data.error);
    });

    socket.on('gameOver', (data) => {
      setGameState(data.state);
    });

    socket.on('playerDisconnected', () => {});

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  const createBotGame = useCallback((elo: number): Promise<{ gameId: string; state: ServerGameState } | null> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve(null);
        return;
      }
      socket.emit('createBotGame', { elo }, (response: any) => {
        if (response?.success) {
          setGameId(response.gameId);
          setGameState(response.state);
          resolve({ gameId: response.gameId, state: response.state });
        } else {
          resolve(null);
        }
      });
    });
  }, []);

  const joinGame = useCallback((gid?: string): Promise<{ gameId: string; state: ServerGameState } | null> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve(null);
        return;
      }
      socket.emit('joinGame', { gameId: gid }, (response: any) => {
        if (response?.success) {
          setGameId(response.gameId);
          setGameState(response.state);
          resolve({ gameId: response.gameId, state: response.state });
        } else {
          resolve(null);
        }
      });
    });
  }, []);

  const makeMove = useCallback((from: string, to: string, promotion?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket || !gameId) {
        resolve(false);
        return;
      }
      socket.emit('makeMove', { gameId, from, to, promotion }, (response: any) => {
        resolve(response?.success ?? false);
      });
    });
  }, [gameId]);

  const resignGame = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket || !gameId) {
        resolve(false);
        return;
      }
      socket.emit('resignGame', { gameId }, (response: any) => {
        resolve(response?.success ?? false);
      });
    });
  }, [gameId]);

  const getServerState = useCallback((gid: string): Promise<ServerGameState | null> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve(null);
        return;
      }
      socket.emit('getGameState', { gameId: gid }, (response: any) => {
        resolve(response?.state ?? null);
      });
    });
  }, []);

  return {
    connected,
    gameState,
    gameId,
    setGameState,
    createBotGame,
    joinGame,
    makeMove,
    resignGame,
    getServerState,
  };
}

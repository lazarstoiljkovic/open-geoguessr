import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import socket from '../modules/socket';
import { GameStatus, Player, Room, Round } from '../types';
import * as gameApi from '../api/game.api';
import { GameMode } from '../types';

interface GameState {
  room: Room | null;
  currentRound: Round | null;
  roundIndex: number;
  totalRounds: number;
  durationSeconds: number;
  status: GameStatus;
  countdownSeconds: number;
  roundCountdown: number;
  myGuess: { lat: number; lng: number } | null;
  myGuessResult: { distanceKm: number; roundScore: number } | null;
  roundResults: { round: Round; players: Player[]; isLastRound: boolean } | null;
  finalResults: { players: Player[] } | null;
}

type Action =
  | { type: 'JOINED_ROOM'; room: Room }
  | { type: 'ROOM_UPDATED'; room: Room }
  | { type: 'GAME_COUNTDOWN'; seconds: number }
  | { type: 'COUNTDOWN_TICK'; remaining: number }
  | { type: 'ROUND_COUNTDOWN'; seconds: number; roundIndex: number }
  | { type: 'ROUND_COUNTDOWN_TICK'; remaining: number }
  | { type: 'ROUND_STARTED'; round: Round; roundIndex: number; totalRounds: number; durationSeconds: number }
  | { type: 'GUESS_PENDING'; lat: number; lng: number }
  | { type: 'GUESS_RESULT'; distanceKm: number; roundScore: number }
  | { type: 'ROUND_ENDED'; round: Round; players: Player[]; isLastRound: boolean }
  | { type: 'GAME_OVER'; players: Player[] }
  | { type: 'RESET' };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'JOINED_ROOM':
      return { ...state, room: action.room, status: action.room.status };
    case 'ROOM_UPDATED':
      return { ...state, room: action.room, status: action.room.status };
    case 'GAME_COUNTDOWN':
      return { ...state, status: 'countdown', countdownSeconds: action.seconds };
    case 'COUNTDOWN_TICK':
      return { ...state, countdownSeconds: action.remaining };
    case 'ROUND_COUNTDOWN':
      return { ...state, status: 'round_countdown' as GameStatus, roundCountdown: action.seconds };
    case 'ROUND_COUNTDOWN_TICK':
      return { ...state, roundCountdown: action.remaining };
    case 'ROUND_STARTED':
      return {
        ...state,
        status: 'playing',
        currentRound: action.round,
        roundIndex: action.roundIndex,
        totalRounds: action.totalRounds,
        durationSeconds: action.durationSeconds,
        myGuess: null,
        myGuessResult: null,
        roundResults: null,
      };
    case 'GUESS_PENDING':
      return { ...state, myGuess: { lat: action.lat, lng: action.lng } };
    case 'GUESS_RESULT':
      return {
        ...state,
        myGuessResult: { distanceKm: action.distanceKm, roundScore: action.roundScore },
      };
    case 'ROUND_ENDED':
      return {
        ...state,
        status: 'round_results',
        roundResults: { round: action.round, players: action.players, isLastRound: action.isLastRound },
        room: state.room ? { ...state.room, players: action.players } : state.room,
      };
    case 'GAME_OVER':
      return { ...state, status: 'game_over', finalResults: { players: action.players } };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const initialState: GameState = {
  room: null,
  currentRound: null,
  roundIndex: 0,
  totalRounds: 5,
  durationSeconds: 60,
  status: 'waiting',
  countdownSeconds: 3,
  roundCountdown: 3,
  myGuess: null,
  myGuessResult: null,
  roundResults: null,
  finalResults: null,
};

interface GameContextValue extends GameState {
  joinRoom: (roomCode: string) => void;
  startGame: (mode?: GameMode, duration?: number, totalRounds?: number) => Promise<void>;
  submitGuess: (lat: number, lng: number) => Promise<void>;
  nextRound: () => Promise<void>;
  leaveRoom: () => void;
  reset: () => void;
  isStarting: boolean;
  isSubmittingGuess: boolean;
  isAdvancingRound: boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const roomCodeRef = useRef<string | undefined>(undefined);

  const [isStarting, setIsStarting] = useState(false);
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
  const [isAdvancingRound, setIsAdvancingRound] = useState(false);

  useEffect(() => {
    roomCodeRef.current = state.room?.code;
  }, [state.room?.code]);

  useEffect(() => {
    const unsubs = [
      socket.on('_reconnected', () => {
        if (roomCodeRef.current) {
          socket.send('join_room', { roomCode: roomCodeRef.current });
        }
      }),
      socket.on('joined_room', (data) => dispatch({ type: 'JOINED_ROOM', room: (data as { room?: Room } & Room).room ?? (data as Room) })),
      socket.on('room_updated', (data) => dispatch({ type: 'ROOM_UPDATED', room: data as Room })),
      socket.on('game_countdown', (data) => {
        setIsStarting(false);
        dispatch({ type: 'GAME_COUNTDOWN', seconds: (data as { seconds: number }).seconds });
      }),
      socket.on('countdown_tick', (data) => dispatch({ type: 'COUNTDOWN_TICK', remaining: (data as { remaining: number }).remaining })),
      socket.on('round_started', (data) => {
        const d = data as { round: Round; roundIndex: number; totalRounds: number; durationSeconds: number };
        dispatch({ type: 'ROUND_STARTED', round: d.round, roundIndex: d.roundIndex, totalRounds: d.totalRounds, durationSeconds: d.durationSeconds });
      }),
      socket.on('round_countdown', (data) => {
        setIsAdvancingRound(false);
        const d = data as { seconds: number; roundIndex: number };
        dispatch({ type: 'ROUND_COUNTDOWN', seconds: d.seconds, roundIndex: d.roundIndex });
      }),
      socket.on('round_countdown_tick', (data) => {
        dispatch({ type: 'ROUND_COUNTDOWN_TICK', remaining: (data as { remaining: number }).remaining });
      }),
      socket.on('round_ended', (data) => {
        setIsSubmittingGuess(false);
        const d = data as { round: Round; players: Player[]; isLastRound: boolean };
        dispatch({ type: 'ROUND_ENDED', round: d.round, players: d.players, isLastRound: d.isLastRound });
      }),
      socket.on('game_over', (data) => {
        setIsAdvancingRound(false);
        dispatch({ type: 'GAME_OVER', players: (data as { players: Player[] }).players });
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const joinRoom = useCallback((roomCode: string) => {
    socket.send('join_room', { roomCode });
  }, []);

  const startGame = useCallback(async (mode: GameMode = 'famous', duration = 60, totalRounds = 5) => {
    const roomCode = roomCodeRef.current;
    if (!roomCode) return;
    setIsStarting(true);
    try {
      await gameApi.startGame(roomCode, mode, duration, totalRounds);
    } catch (err) {
      console.error('[startGame]', err);
      setIsStarting(false);
    }
  }, []);

  const submitGuess = useCallback(async (lat: number, lng: number) => {
    const roomCode = roomCodeRef.current;
    if (!roomCode) return;
    dispatch({ type: 'GUESS_PENDING', lat, lng });
    setIsSubmittingGuess(true);
    try {
      const result = await gameApi.submitGuess(roomCode, lat, lng);
      dispatch({ type: 'GUESS_RESULT', distanceKm: result.distanceKm, roundScore: result.roundScore });
    } catch (err) {
      console.error('[submitGuess]', err);
    } finally {
      setIsSubmittingGuess(false);
    }
  }, []);

  const nextRound = useCallback(async () => {
    const roomCode = roomCodeRef.current;
    if (!roomCode) return;
    setIsAdvancingRound(true);
    try {
      await gameApi.nextRound(roomCode);
    } catch (err) {
      console.error('[nextRound]', err);
      setIsAdvancingRound(false);
    }
  }, []);

  const leaveRoom = useCallback(() => {
    socket.send('leave_room', {});
    dispatch({ type: 'RESET' });
  }, []);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return (
    <GameContext.Provider value={{
      ...state,
      joinRoom,
      startGame,
      submitGuess,
      nextRound,
      leaveRoom,
      reset,
      isStarting,
      isSubmittingGuess,
      isAdvancingRound,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

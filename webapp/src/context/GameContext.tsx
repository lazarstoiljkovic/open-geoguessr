import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import socket from '../modules/socket';
import { EliminationRoundResult, GameStatus, LivePin, Player, Room, Round, RoundGuess } from '../types';
import * as gameApi from '../api/game.api';
import { ChatMessage } from '../components/Chat/Chat';

export interface RoundSummary {
  index: number;
  locationName: string;
  locationCountry?: string;
  guesses: RoundGuess[];
  players: Player[];
  elimination?: EliminationRoundResult;
}

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
  roundResults: { round: Round; players: Player[]; isLastRound: boolean; elimination?: EliminationRoundResult } | null;
  finalResults: { players: Player[] } | null;
  allRoundResults: RoundSummary[];
  messages: ChatMessage[];
  eliminatedPlayerIds: string[];
  livePlayerPins: LivePin[];
}

type Action =
  | { type: 'JOINED_ROOM'; room: Room }
  | { type: 'ROOM_UPDATED'; room: Room }
  | { type: 'GAME_COUNTDOWN'; seconds: number }
  | { type: 'COUNTDOWN_TICK'; remaining: number }
  | { type: 'ROUND_COUNTDOWN'; seconds: number; roundIndex: number }
  | { type: 'ROUND_COUNTDOWN_TICK'; remaining: number }
  | { type: 'ROUND_STARTED'; round: Round; roundIndex: number; totalRounds: number; durationSeconds: number; eliminatedPlayerIds: string[] }
  | { type: 'GUESS_PENDING'; lat: number; lng: number }
  | { type: 'GUESS_RESULT'; distanceKm: number; roundScore: number }
  | { type: 'ROUND_ENDED'; round: Round; players: Player[]; isLastRound: boolean; eliminatedPlayerIds: string[]; elimination?: EliminationRoundResult }
  | { type: 'GAME_OVER'; players: Player[] }
  | { type: 'CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'CHAT_HISTORY'; messages: ChatMessage[] }
  | { type: 'PIN_MOVE'; pin: LivePin }
  | { type: 'RESET' };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'JOINED_ROOM': {
      const newStatus = action.room.status as GameStatus;
      const finalResults =
        newStatus === 'game_over' && !state.finalResults
          ? { players: action.room.players as Player[] }
          : state.finalResults;
      return {
        ...state,
        room: action.room,
        status: newStatus,
        finalResults,
        eliminatedPlayerIds: action.room.eliminatedPlayerIds ?? [],
      };
    }
    case 'ROOM_UPDATED':
      return {
        ...state,
        room: action.room,
        status: action.room.status,
        eliminatedPlayerIds: action.room.eliminatedPlayerIds ?? [],
      };
    case 'GAME_COUNTDOWN':
      return { ...state, status: 'countdown', countdownSeconds: action.seconds };
    case 'COUNTDOWN_TICK':
      return { ...state, countdownSeconds: action.remaining };
    case 'ROUND_COUNTDOWN':
      return { ...state, status: 'round_countdown' as GameStatus, roundCountdown: action.seconds };
    case 'ROUND_COUNTDOWN_TICK':
      return { ...state, roundCountdown: action.remaining };
    case 'ROUND_STARTED': {
      const isSameRound = action.roundIndex === state.roundIndex;
      return {
        ...state,
        status: 'playing',
        currentRound: action.round,
        roundIndex: action.roundIndex,
        totalRounds: action.totalRounds,
        durationSeconds: action.durationSeconds,
        myGuess: isSameRound ? state.myGuess : null,
        myGuessResult: isSameRound ? state.myGuessResult : null,
        roundResults: null,
        eliminatedPlayerIds: action.eliminatedPlayerIds,
        livePlayerPins: [],
      };
    }
    case 'GUESS_PENDING':
      return { ...state, myGuess: { lat: action.lat, lng: action.lng } };
    case 'GUESS_RESULT':
      return {
        ...state,
        myGuessResult: { distanceKm: action.distanceKm, roundScore: action.roundScore },
      };
    case 'ROUND_ENDED': {
      const summary: RoundSummary = {
        index: action.round.index,
        locationName: action.round.location.name,
        locationCountry: (action.round.location as { country?: string }).country,
        guesses: action.round.guesses,
        players: action.players,
        elimination: action.elimination,
      };
      const alreadyHas = state.allRoundResults.some((r) => r.index === action.round.index);
      return {
        ...state,
        status: 'round_results',
        roundResults: {
          round: action.round,
          players: action.players,
          isLastRound: action.isLastRound,
          elimination: action.elimination,
        },
        room: state.room ? { ...state.room, players: action.players } : state.room,
        allRoundResults: alreadyHas ? state.allRoundResults : [...state.allRoundResults, summary],
        eliminatedPlayerIds: action.eliminatedPlayerIds,
        livePlayerPins: [],
      };
    }
    case 'GAME_OVER':
      return { ...state, status: 'game_over', finalResults: { players: action.players } };
    case 'CHAT_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'CHAT_HISTORY':
      return { ...state, messages: action.messages };
    case 'PIN_MOVE': {
      const updated = state.livePlayerPins.filter((p) => p.userId !== action.pin.userId);
      return { ...state, livePlayerPins: [...updated, action.pin] };
    }
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
  allRoundResults: [],
  messages: [],
  eliminatedPlayerIds: [],
  livePlayerPins: [],
};

// ── Session persistence ────────────────────────────────────────────────────

const SESSION_KEY = 'og_game_state';

function persistState(state: GameState): void {
  const { countdownSeconds, roundCountdown, messages, livePlayerPins, ...toSave } = state;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(toSave));
  } catch { /* ignore */ }
}

function loadPersistedState(): Partial<GameState> | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Partial<GameState>) : null;
  } catch {
    return null;
  }
}

function makeInitialState(): GameState {
  const persisted = loadPersistedState();
  if (persisted?.room) return { ...initialState, ...persisted };
  return initialState;
}

// ── Context ────────────────────────────────────────────────────────────────

interface GameContextValue extends GameState {
  joinRoom: (roomCode: string) => void;
  startGame: () => Promise<void>;
  submitGuess: (lat: number, lng: number) => Promise<void>;
  nextRound: () => Promise<void>;
  leaveRoom: () => void;
  reset: () => void;
  sendMessage: (text: string) => void;
  broadcastPinMove: (lat: number, lng: number) => void;
  isStarting: boolean;
  isSubmittingGuess: boolean;
  isAdvancingRound: boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
  const roomCodeRef = useRef<string | undefined>(undefined);

  const [isStarting, setIsStarting] = useState(false);
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
  const [isAdvancingRound, setIsAdvancingRound] = useState(false);

  useEffect(() => {
    roomCodeRef.current = state.room?.code;
  }, [state.room?.code]);

  useEffect(() => {
    persistState(state);
  }, [state]);

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
        const d = data as { round: Round; roundIndex: number; totalRounds: number; durationSeconds: number; eliminatedPlayerIds?: string[] };
        dispatch({
          type: 'ROUND_STARTED',
          round: d.round,
          roundIndex: d.roundIndex,
          totalRounds: d.totalRounds,
          durationSeconds: d.durationSeconds,
          eliminatedPlayerIds: d.eliminatedPlayerIds ?? [],
        });
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
        const d = data as { round: Round; players: Player[]; isLastRound: boolean; eliminatedPlayerIds?: string[]; elimination?: EliminationRoundResult };
        dispatch({
          type: 'ROUND_ENDED',
          round: d.round,
          players: d.players,
          isLastRound: d.isLastRound,
          eliminatedPlayerIds: d.eliminatedPlayerIds ?? [],
          elimination: d.elimination,
        });
      }),
      socket.on('game_over', (data) => {
        setIsAdvancingRound(false);
        dispatch({ type: 'GAME_OVER', players: (data as { players: Player[] }).players });
      }),
      socket.on('new_message', (data) => {
        dispatch({ type: 'CHAT_MESSAGE', message: data as ChatMessage });
      }),
      socket.on('chat_history', (data) => {
        dispatch({ type: 'CHAT_HISTORY', messages: (data as { messages: ChatMessage[] }).messages });
      }),
      socket.on('spectator_pin_move', (data) => {
        dispatch({ type: 'PIN_MOVE', pin: data as LivePin });
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const joinRoom = useCallback((roomCode: string) => {
    socket.send('join_room', { roomCode });
  }, []);

  const startGame = useCallback(async () => {
    const roomCode = roomCodeRef.current;
    if (!roomCode) return;
    setIsStarting(true);
    try {
      await gameApi.startGame(roomCode);
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
    sessionStorage.removeItem(SESSION_KEY);
    socket.send('leave_room', {});
    dispatch({ type: 'RESET' });
  }, []);

  const reset = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    dispatch({ type: 'RESET' });
  }, []);

  const sendMessage = useCallback((text: string) => {
    socket.send('send_message', { text });
  }, []);

  const broadcastPinMove = useCallback((lat: number, lng: number) => {
    socket.send('pin_move', { lat, lng });
  }, []);

  return (
    <GameContext.Provider value={{
      ...state,
      joinRoom,
      startGame,
      submitGuess,
      nextRound,
      leaveRoom,
      reset,
      sendMessage,
      broadcastPinMove,
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

import { create } from "zustand";
import { socket } from "./socket";

const EVENTS = {
  PLAY_CARD:  "play_card",
  END_TURN:   "end_turn",
  UNDO_CARD:  "undo_card",
  GAME_STATE: "game_state",
  GAME_OVER:  "game_over",
  GAME_START: "game_start",
  ERROR:      "error",
} as const;

type PileState = {
  id: string;
  direction: "asc" | "desc";
  top: number;
  start: number;
};

type PlayerState = {
  id: string;
  pseudo: string;
  hand: (number | null)[];
  deckSize: number;
};

type GameState = {
  roomId: string;
  myPlayerId: string;
  players: PlayerState[];
  piles: PileState[];
  currentPlayerId: string;
  turnNumber: number;
  cardsPlayedThisTurn: number;
};

type GameStore = {
  pseudo: string;
  playerId: string;
  roomCode: string;
  mode: "duel" | "coop";
  error: string | null;

  setPseudo: (pseudo: string) => void;
  setRoomCode: (code: string) => void;
  setMode: (mode: "duel" | "coop") => void;
  createRoom: () => Promise<void>;
  joinRoom: () => Promise<void>;

  phase: "lobby" | "waiting" | "game" | "over";
  gameState: GameState | null;
  errorMessage: string | null;
  gameOverResult: { winnerId: string; reason: string } | null;

  // Undo — nombre de coups posés ce tour (pour afficher/cacher le bouton)
  turnMovesCount: number;

  setPhase: (phase: "lobby" | "waiting" | "game" | "over") => void;
  clearError: () => void;
};

function connectAndEmit(event: string, payload: object) {
  if (socket.connected) {
    socket.emit(event, payload);
  } else {
    socket.once("connect", () => socket.emit(event, payload));
    socket.connect();
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  pseudo: "",
  playerId: "",
  roomCode: "",
  mode: "duel",
  error: null,
  turnMovesCount: 0,

  setPseudo:   (pseudo)   => set({ pseudo }),
  setRoomCode: (roomCode) => set({ roomCode }),
  setMode:     (mode)     => set({ mode }),

  createRoom: async () => {
    const { pseudo, mode } = get();
    if (!pseudo.trim()) return;
    set({ error: null, phase: "waiting" });

    const res = await fetch("http://localhost:3001/game/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pseudo, mode }),
    });

    const { roomId, playerId } = await res.json();
    set({ roomCode: roomId, playerId });
    connectAndEmit("join_room", { roomId, playerId, pseudo });
  },

  joinRoom: async () => {
    const { pseudo, roomCode } = get();
    if (!pseudo.trim() || !roomCode.trim()) return;
    set({ error: null, phase: "waiting" });

    const playerId = crypto.randomUUID();
    set({ playerId });
    connectAndEmit("join_room", { roomId: roomCode, playerId, pseudo });
  },

  phase: "lobby",
  gameState: null,
  errorMessage: null,
  gameOverResult: null,

  setPhase:   (phase) => set({ phase }),
  clearError: ()      => set({ errorMessage: null }),
}));

// ------------------------------------------------------------
// Listeners
// ------------------------------------------------------------

socket
  .off(EVENTS.GAME_START)
  .on(EVENTS.GAME_START, () => {
    useGameStore.setState({ phase: "game", turnMovesCount: 0 });
  });

socket
  .off(EVENTS.GAME_STATE)
  .on(EVENTS.GAME_STATE, (state: GameState) => {
    console.log("GAME_STATE reçu", state.cardsPlayedThisTurn);
    useGameStore.setState({ gameState: { ...state }, phase: "game" });
  });

socket
  .off(EVENTS.ERROR)
  .on(EVENTS.ERROR, (payload: { message: string }) => {
    useGameStore.setState({ errorMessage: payload.message, error: payload.message });
  });

socket
  .off(EVENTS.GAME_OVER)
  .on(EVENTS.GAME_OVER, (payload: { winnerId: string; reason: string }) => {
    useGameStore.setState({ phase: "over", gameOverResult: payload });
  });

// ------------------------------------------------------------
// Reconnexion
// ------------------------------------------------------------

socket
  .off("connect")
  .on("connect", () => {
    const { playerId, roomCode, pseudo, phase } = useGameStore.getState();
    if (playerId && roomCode && (phase === "game" || phase === "waiting")) {
      console.log("reconnect → re-join room", roomCode);
      socket.emit("join_room", { roomId: roomCode, playerId, pseudo });
    }
  });

socket
  .off("disconnect")
  .on("disconnect", (reason) => {
    console.log("❌ disconnect reason:", reason);
  });

socket
  .off("connect_error")
  .on("connect_error", (err) => {
    console.log("❌ connect_error:", err.message);
  });
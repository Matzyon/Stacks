// ============================================================
// types.ts — Contrats partagés The Game
// Utilisés par : rules/ + rooms/ + frontend
// ============================================================

// ------------------------------------------------------------
// Primitives
// ------------------------------------------------------------

/** Valeur d'une carte (1–60 en Duel, 2–99 en Coop) */
export type CardValue = number

/** Direction d'une pile */
export type PileDirection = "asc" | "desc"

/** Modes de jeu */
export type GameMode = "duel" | "coop" | "custom"

/** Résultat d'une partie */
export type GameResult = "win" | "loss" | "ongoing"

// ------------------------------------------------------------
// Pile
// ------------------------------------------------------------

export interface Pile {
  id: string           // ex: "p0_asc", "p1_desc", "common_asc_1"
  direction: PileDirection
  top: CardValue       // valeur actuelle au sommet
  start: CardValue     // valeur de départ (1 ou 60 en Duel, 1 ou 100 en Coop)
}

// ------------------------------------------------------------
// Joueur
// ------------------------------------------------------------

export interface Player {
  id: string           // socket id ou user id
  pseudo: string
  hand: CardValue[]    // cartes en main (max 6 ou 7)
  deckSize: number     // nombre de cartes restantes en pioche
}

// ------------------------------------------------------------
// Move — ce qu'un joueur envoie au serveur
// ------------------------------------------------------------

export interface Move {
  playerId: string
  pileId: string       // identifiant de la pile ciblée
  card: CardValue
}

// ------------------------------------------------------------
// MoveResult — ce que le serveur renvoie après validation
// ------------------------------------------------------------

export type MoveError =
  | "not_your_turn"
  | "card_not_in_hand"
  | "invalid_pile"
  | "invalid_move"
  | "cannot_play_on_opponent_pile"   // Duel : tentative non bénéfique
  | "game_over"

export interface MoveResult {
  valid: boolean
  error?: MoveError
  delta?: MoveDelta    // présent seulement si valid === true
}

// ------------------------------------------------------------
// MoveDelta — ce qui change après un coup valide
// Envoyé aux deux clients via Socket.io (payload minimal)
// ------------------------------------------------------------

export interface MoveDelta {
  playerId: string
  pileId: string
  card: CardValue
  newTop: CardValue
  isRewind: boolean    // true si règle du recul (-10 / +10)
  isOpponentPile: boolean  // Duel seulement
}

// ------------------------------------------------------------
// TurnResult — résultat complet d'une fin de tour
// ------------------------------------------------------------

export interface TurnResult {
  draws: number        // nombre de cartes piochées (2 ou retour à 6)
  gameResult: GameResult
  reason?: "deck_empty" | "min_cards_not_met" | "opponent_blocked"
}

// ------------------------------------------------------------
// GameState — état complet d'une partie (en mémoire)
// Envoyé uniquement à la connexion / reconnexion (snapshot)
// ------------------------------------------------------------

export interface GameState {
  roomId: string
  mode: GameMode
  players: Player[]
  piles: Pile[]
  currentPlayerId: string
  turnNumber: number
  cardsPlayedThisTurn: number   // pour valider le min de 2
  playedOnOpponentThisTurn: boolean  // Duel : détermine la pioche
  result: GameResult
  startedAt: number   // timestamp ms
}

// ------------------------------------------------------------
// Config — paramètres d'une partie (utile pour Custom v2)
// ------------------------------------------------------------

export interface GameConfig {
  mode: GameMode
  rewindEnabled: boolean      // règle du -10 / +10
  minCardsPerTurn: number     // défaut : 2
  handSize: number            // défaut : 6 (7 pour coop 2j)
  deckSize: number            // 58 en Duel, variable en Coop
  allowOpponentPiles: boolean // Duel seulement
  maxPlayers: number
}

// ------------------------------------------------------------
// Configs par défaut exportées
// ------------------------------------------------------------

export const DUEL_CONFIG: GameConfig = {
  mode: "duel",
  rewindEnabled: true,
  minCardsPerTurn: 2,
  handSize: 6,
  deckSize: 58,
  allowOpponentPiles: true,
  maxPlayers: 2,
}

export const COOP_CONFIG: GameConfig = {
  mode: "coop",
  rewindEnabled: true,
  minCardsPerTurn: 2,
  handSize: 6,       // ajusté dynamiquement à 7 si 2 joueurs
  deckSize: 98,      // 98 cartes au total (2→99)
  allowOpponentPiles: false,
  maxPlayers: 6,
}

// ------------------------------------------------------------
// Socket events — noms des événements (évite les typos)
// ------------------------------------------------------------

export const EVENTS = {
  // Client → Serveur
  JOIN_ROOM:    "join_room",
  PLAY_CARD:    "play_card",
  END_TURN:     "end_turn",
  SIGNAL:       "signal",       // Coop : signal vague ("attention")
  RECONNECT:    "reconnect",

  // Serveur → Client
  GAME_START:   "game_start", 
  GAME_STATE:   "game_state",   // snapshot complet (connexion/reconnexion)
  MOVE_RESULT:  "move_result",  // delta après un coup
  TURN_RESULT:  "turn_result",  // résultat fin de tour + pioche
  GAME_OVER:    "game_over",    // fin de partie
  PLAYER_LEFT:  "player_left",  // déconnexion détectée
  ERROR:        "error",
} as const

export type EventName = typeof EVENTS[keyof typeof EVENTS]

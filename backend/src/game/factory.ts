// ============================================================
// factory.ts — Création de l'état initial d'une partie
// Stacks — v1.0
// ============================================================

import type { GameState, GameMode, Pile, Player } from "./types"
import { DUEL_CONFIG, COOP_CONFIG } from "./types"
import { getHandSize } from "./coop.rules"
import { shuffle } from "./utils/deck.utils"

// ------------------------------------------------------------
// createInitialState
// ------------------------------------------------------------

export function createInitialState(
  roomId: string,
  mode: GameMode,
  firstPlayerId: string,
  firstPseudo: string
): GameState {
  if (mode === "duel") return createDuelState(roomId, firstPlayerId, firstPseudo)
  return createCoopState(roomId, firstPlayerId, firstPseudo)
}

// ------------------------------------------------------------
// createDuelState
// Chaque joueur a son jeu de 60 cartes (1→60)
// 2 piles perso, 6 cartes en main
// ------------------------------------------------------------

function createDuelState(roomId: string, playerId: string, pseudo: string): GameState {
  const deck = shuffle(Array.from({ length: 58 }, (_, i) => i + 2)) // 2→59
  const hand = deck.splice(0, DUEL_CONFIG.handSize)

  const players: Player[] = [{ id: playerId, pseudo, hand, deckSize: deck.length }]
  const piles: Pile[] = [
    { id: "p0_asc",  direction: "asc",  top: 1,  start: 1  },
    { id: "p0_desc", direction: "desc", top: 60, start: 60 },
  ]

  return baseState(roomId, "duel", players, piles)
}

// ------------------------------------------------------------
// createCoopState
// 98 cartes communes (2→99), 4 piles communes
// ------------------------------------------------------------

function createCoopState(roomId: string, playerId: string, pseudo: string): GameState {
  const deck = shuffle(Array.from({ length: 98 }, (_, i) => i + 2)) // 2→99
  const handSize = getHandSize(1)
  const hand = deck.splice(0, handSize)

  const players: Player[] = [{ id: playerId, pseudo, hand, deckSize: deck.length }]
  const piles: Pile[] = [
    { id: "common_asc_1",  direction: "asc",  top: 1,   start: 1   },
    { id: "common_asc_2",  direction: "asc",  top: 1,   start: 1   },
    { id: "common_desc_1", direction: "desc", top: 100, start: 100 },
    { id: "common_desc_2", direction: "desc", top: 100, start: 100 },
  ]

  return baseState(roomId, "coop", players, piles)
}

// ------------------------------------------------------------
// baseState — structure commune aux deux modes
// ------------------------------------------------------------

function baseState(
  roomId: string,
  mode: GameMode,
  players: Player[],
  piles: Pile[]
): GameState {
  return {
    roomId,
    mode,
    players,
    piles,
    currentPlayerId: players[0]!.id,
    turnNumber: 1,
    cardsPlayedThisTurn: 0,
    playedOnOpponentThisTurn: false,
    result: "ongoing",
    startedAt: Date.now(),
  }
}
// ============================================================
// factory.ts — Création de l'état initial d'une partie
// ============================================================

import type { GameState, GameMode, Pile, Player } from "./types"
import { DUEL_CONFIG, COOP_CONFIG } from "./types"
import { getHandSize } from "./coop.rules"

// ------------------------------------------------------------
// shuffle — mélange un tableau en place (Fisher-Yates)
// ------------------------------------------------------------

function shuffle(arr: number[]): number[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]!; arr[i] = arr[j]!; arr[j] = tmp
  }
  return arr
}

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
  const deck = shuffle(Array.from({ length: 58 }, (_, i) => i + 2)) // 2→59 (1 et 60 sont les bases)
  const hand = deck.splice(0, DUEL_CONFIG.handSize)

  const players: Player[] = [{
    id: playerId,
    pseudo,
    hand,
    deckSize: deck.length,
  }]

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
  const handSize = getHandSize(1) // sera recalculé quand tous les joueurs rejoignent
  const hand = deck.splice(0, handSize)

  const players: Player[] = [{
    id: playerId,
    pseudo,
    hand,
    deckSize: deck.length,
  }]

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

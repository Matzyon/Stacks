// ============================================================
// duel.rules.ts — Règles spécifiques au mode Duel
// ============================================================

import type { GameState, Move, MoveResult, TurnResult, Pile } from "./types"
import { isValidMove, isRewind, applyCard, canMeetMinimum } from "./core.rules"
import { DUEL_CONFIG } from "./types"

const MIN_CARDS_PER_TURN = DUEL_CONFIG.minCardsPerTurn
const HAND_SIZE          = DUEL_CONFIG.handSize
const DRAW_SOLO          = 2

export function getPilesForPlayer(piles: Pile[], playerIndex: number): Pile[] {
  const start = playerIndex * 2
  return piles.slice(start, start + 2)
}

export function getOpponentPiles(piles: Pile[], playerIndex: number): Pile[] {
  const opponentIndex = playerIndex === 0 ? 1 : 0
  return getPilesForPlayer(piles, opponentIndex)
}

export function isOpponentPile(pileId: string, playerIndex: number): boolean {
  const opponentIndex = playerIndex === 0 ? 1 : 0
  return pileId.startsWith(`p${opponentIndex}_`)
}

// ------------------------------------------------------------
// canPlayOnOpponentPile
// On peut jouer sur une pile adverse uniquement si c'est
// BÉNÉFIQUE pour l'adversaire (fait reculer sa pile) :
//   - Pile ascendante adverse  : carte STRICTEMENT inférieure au sommet
//   - Pile descendante adverse : carte STRICTEMENT supérieure au sommet
//
// ⚠️ NE PAS utiliser isRewind ici — la logique est inversée
// par rapport aux piles personnelles.
// ------------------------------------------------------------
export function canPlayOnOpponentPile(pile: Pile, card: number): boolean {
  if (pile.direction === "asc") {
    return card < pile.top
  } else {
    return card > pile.top
  }
}

export function validateMove(state: GameState, move: Move): MoveResult {
  const { playerId, pileId, card } = move

  if (state.currentPlayerId !== playerId) return { valid: false, error: "not_your_turn" }
  if (state.result !== "ongoing") return { valid: false, error: "game_over" }

  const playerIndex = state.players.findIndex(p => p.id === playerId)
  const player = state.players[playerIndex]
  if (!player || !player.hand.includes(card)) return { valid: false, error: "card_not_in_hand" }

  const pile = state.piles.find(p => p.id === pileId)
  if (!pile) return { valid: false, error: "invalid_pile" }

  if (isOpponentPile(pileId, playerIndex)) {
    if (!canPlayOnOpponentPile(pile, card)) return { valid: false, error: "cannot_play_on_opponent_pile" }
  } else {
    if (!isValidMove(pile, card)) return { valid: false, error: "invalid_move" }
  }

  return {
    valid: true,
    delta: {
      playerId,
      pileId,
      card,
      newTop: applyCard(pile, card),
      isRewind: isRewind(pile, card),
      isOpponentPile: isOpponentPile(pileId, playerIndex),
    }
  }
}

export function endTurn(state: GameState, playerIndex: number): TurnResult {
  if (state.cardsPlayedThisTurn < MIN_CARDS_PER_TURN) {
    return { draws: 0, gameResult: "loss", reason: "min_cards_not_met" }
  }

  const currentPlayer = state.players[playerIndex]
  if (!currentPlayer) return { draws: 0, gameResult: "loss", reason: "min_cards_not_met" }

  const draws = state.playedOnOpponentThisTurn
    ? Math.max(0, HAND_SIZE - currentPlayer.hand.length)
    : DRAW_SOLO

  const opponentIndex = playerIndex === 0 ? 1 : 0
  const opponent = state.players[opponentIndex]
  const opponentPiles = getPilesForPlayer(state.piles, opponentIndex)

  const opponentBlocked = !opponent || !canMeetMinimum(opponent.hand, opponentPiles, MIN_CARDS_PER_TURN)
  if (opponentBlocked) return { draws, gameResult: "win", reason: "opponent_blocked" }

  const hasWon = currentPlayer.deckSize === 0 && currentPlayer.hand.length === 0
  if (hasWon) return { draws, gameResult: "win" }

  return { draws, gameResult: "ongoing" }
}

export function getPlayablePiles(state: GameState, playerId: string, card: number): string[] {
  const playerIndex = state.players.findIndex(p => p.id === playerId)
  const ownPiles = getPilesForPlayer(state.piles, playerIndex)
  const opponentPiles = getOpponentPiles(state.piles, playerIndex)
  const playable: string[] = []

  for (const pile of ownPiles) {
    if (isValidMove(pile, card)) playable.push(pile.id)
  }
  for (const pile of opponentPiles) {
    if (canPlayOnOpponentPile(pile, card)) playable.push(pile.id)
  }

  return playable
}
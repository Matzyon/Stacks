// ============================================================
// coop.rules.ts — Règles spécifiques au mode Coopératif
// ============================================================

import type { GameState, Move, MoveResult, TurnResult, Pile } from "./types"
import { isValidMove, isRewind, applyCard, canMeetMinimum } from "./core.rules"
import { COOP_CONFIG } from "./types"

// ------------------------------------------------------------
// Constantes Coop
// ------------------------------------------------------------

const MIN_CARDS_PER_TURN = COOP_CONFIG.minCardsPerTurn  // 2
const TOTAL_CARDS        = 98  // cartes à poser pour gagner (2→99)

// ------------------------------------------------------------
// getHandSize
// En coop, la main est de 7 cartes à 2 joueurs, 6 sinon
// ------------------------------------------------------------

export function getHandSize(playerCount: number): number {
  return playerCount === 2 ? 7 : 6
}

// ------------------------------------------------------------
// validateMove
// En coop, tout le monde joue sur les 4 piles communes
// Pas de notion de pile adverse
// ------------------------------------------------------------

export function validateMove(state: GameState, move: Move): MoveResult {
  const { playerId, pileId, card } = move

  if (state.currentPlayerId !== playerId) {
    return { valid: false, error: "not_your_turn" }
  }

  if (state.result !== "ongoing") {
    return { valid: false, error: "game_over" }
  }

  const player = state.players.find(p => p.id === playerId)
  if (!player || !player.hand.includes(card)) {
    return { valid: false, error: "card_not_in_hand" }
  }

  const pile = state.piles.find(p => p.id === pileId)
  if (!pile) {
    return { valid: false, error: "invalid_pile" }
  }

  if (!isValidMove(pile, card)) {
    return { valid: false, error: "invalid_move" }
  }

  return {
    valid: true,
    delta: {
      playerId,
      pileId,
      card,
      newTop: applyCard(pile, card),
      isRewind: isRewind(pile, card),
      isOpponentPile: false,
    }
  }
}

// ------------------------------------------------------------
// endTurn
// Vérifie le minimum, calcule la pioche, détecte fin de partie
// ------------------------------------------------------------

export function endTurn(state: GameState): TurnResult {
  if (state.cardsPlayedThisTurn < MIN_CARDS_PER_TURN) {
    return { draws: 0, gameResult: "loss", reason: "min_cards_not_met" }
  }

  // Victoire : toutes les cartes ont été posées
  const totalPlayed = countPlayedCards(state)
  if (totalPlayed === TOTAL_CARDS) {
    return { draws: 0, gameResult: "win" }
  }

  // Défaite : le prochain joueur ne peut pas poser 2 cartes
  const nextPlayer = getNextPlayer(state)
  if (!nextPlayer) {
    return { draws: 0, gameResult: "loss", reason: "min_cards_not_met" }
  }

  const blocked = !canMeetMinimum(nextPlayer.hand, state.piles, MIN_CARDS_PER_TURN)
  if (blocked) {
    return { draws: 0, gameResult: "loss", reason: "min_cards_not_met" }
  }

  const handSize = getHandSize(state.players.length)
  const player = state.players.find(p => p.id === state.currentPlayerId)
  const draws = player ? Math.max(0, handSize - player.hand.length) : 0

  return { draws, gameResult: "ongoing" }
}

// ------------------------------------------------------------
// countPlayedCards
// Compte les cartes posées en comparant les sommets aux départs
// ------------------------------------------------------------

function countPlayedCards(state: GameState): number {
  return state.piles.reduce((total, pile) => {
    if (pile.direction === "asc") return total + (pile.top - pile.start)
    return total + (pile.start - pile.top)
  }, 0)
}

// ------------------------------------------------------------
// getNextPlayer
// Retourne le joueur suivant dans l'ordre du tour
// ------------------------------------------------------------

function getNextPlayer(state: GameState) {
  const currentIndex = state.players.findIndex(p => p.id === state.currentPlayerId)
  const nextIndex = (currentIndex + 1) % state.players.length
  return state.players[nextIndex]
}

// ============================================================
// state.builder.ts — Construction des états personnalisés
// Stacks — v1.0
// ============================================================

import type { GameState } from "../types"

/**
 * Construit un état de jeu filtré pour un joueur donné.
 * - Le joueur voit sa propre main en clair
 * - Il voit la taille de main adverse (null par carte) mais pas les valeurs
 * - Les piles et l'état général sont partagés
 */
export function buildPersonalizedState(
  state: GameState,
  privateDecks: Record<string, number[]>,
  playerId: string
) {
  return {
    roomId: state.roomId,
    myPlayerId: playerId,
    players: state.players.map((p) => ({
      id: p.id,
      pseudo: p.pseudo,
      hand: p.id === playerId ? p.hand : p.hand.map(() => null),
      deckSize: privateDecks[p.id]?.length ?? p.deckSize,
    })),
    piles: state.piles,
    currentPlayerId: state.currentPlayerId,
    turnNumber: state.turnNumber,
    cardsPlayedThisTurn: state.cardsPlayedThisTurn,
  }
}
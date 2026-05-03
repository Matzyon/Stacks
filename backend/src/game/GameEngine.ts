// ============================================================
// GameEngine.ts — Orchestrateur
// Délègue aux rules selon le mode, ne contient pas de logique
// ============================================================

import type { GameState, Move, MoveResult, TurnResult } from "./types"
import * as DuelRules from "./duel.rules"
import * as CoopRules from "./coop.rules"

export class GameEngine {
  private state: GameState

  constructor(state: GameState) {
    this.state = state
  }

  // Valide et applique un coup
  playCard(move: Move): MoveResult {
    const rules = this.state.mode === "duel" ? DuelRules : CoopRules
    const result = rules.validateMove(this.state, move)

    if (!result.valid || !result.delta) return result

    // Applique le delta sur le state
    const pile = this.state.piles.find(p => p.id === result.delta!.pileId)
    if (pile) pile.top = result.delta.newTop

    const player = this.state.players.find(p => p.id === move.playerId)
    if (player) player.hand = player.hand.filter(c => c !== move.card)

    this.state.cardsPlayedThisTurn++
    if (result.delta.isOpponentPile) this.state.playedOnOpponentThisTurn = true

    return result
  }

  // Clôture le tour et retourne ce qui s'est passé
  endTurn(): TurnResult {
    const playerIndex = this.state.players.findIndex(
      p => p.id === this.state.currentPlayerId
    )

    const result = this.state.mode === "duel"
      ? DuelRules.endTurn(this.state, playerIndex)
      : CoopRules.endTurn(this.state)

    if (result.gameResult !== "ongoing") {
      this.state.result = result.gameResult
      return result
    }

    // Passe au joueur suivant
    const nextIndex = (playerIndex + 1) % this.state.players.length
    this.state.currentPlayerId = this.state.players[nextIndex]!.id
    this.state.turnNumber++
    this.state.cardsPlayedThisTurn = 0
    this.state.playedOnOpponentThisTurn = false

    return result
  }

  // Retourne l'état complet (connexion / reconnexion uniquement)
  getSnapshot(): GameState {
    return this.state
  }
}

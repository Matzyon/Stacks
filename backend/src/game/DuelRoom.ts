// ============================================================
// DuelRoom.ts — Room Socket.io pour le mode Duel
// Stacks — v1.0
// ============================================================

import { Server, Socket } from "socket.io"
import { EVENTS, DUEL_CONFIG } from "./types"
import type { GameState, Pile, Player } from "./types"
import type { IRoom } from "./IRoom"
import { validateMove, endTurn } from "./duel.rules"
import { shuffle, drawCards } from "./utils/deck.utils"
import { buildPersonalizedState } from "./utils/state.builder"

const HAND_SIZE = DUEL_CONFIG.handSize // 6

// ------------------------------------------------------------
// TurnMove — snapshot d'un coup pour permettre le undo
// ------------------------------------------------------------

interface TurnMove {
  card: number
  pileId: string
  previousTop: number
  wasOpponentPile: boolean
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function createPlayerPiles(playerIndex: number): Pile[] {
  const prefix = `p${playerIndex}`
  return [
    { id: `${prefix}_asc`,  direction: "asc",  top: 1,  start: 1  },
    { id: `${prefix}_desc`, direction: "desc", top: 60, start: 60 },
  ]
}

function buildInitialDeck(hand: number[]): number[] {
  const inHand = new Set(hand)
  return shuffle(Array.from({ length: 58 }, (_, i) => i + 2).filter(c => !inHand.has(c)))
}

// ------------------------------------------------------------
// DuelRoom
// ------------------------------------------------------------

export class DuelRoom implements IRoom {
  private state: GameState
  private io: Server
  private privateDecks: Record<string, number[]> = {}
  private socketIds: Record<string, string> = {}
  private turnMoves: Record<string, TurnMove[]> = {}

  constructor(io: Server, initialState: GameState) {
    this.io = io
    this.state = initialState

    for (const player of this.state.players) {
      this.privateDecks[player.id] = buildInitialDeck(player.hand)
      this.turnMoves[player.id] = []
    }
  }

  get playerCount(): number {
    return this.state.players.length
  }

  // ----------------------------------------------------------
  // join
  // ----------------------------------------------------------

  join(socket: Socket, playerId: string, pseudo: string): void {
    const existing = this.state.players.find(p => p.id === playerId)

    if (existing) {
      existing.pseudo = pseudo
      this.socketIds[playerId] = socket.id
    } else {
      this.addSecondPlayer(playerId, pseudo, socket.id)
    }

    socket.join(this.state.roomId)
    this.emitToAll()

    if (this.state.players.length === 2) {
      this.io.to(this.state.roomId).emit(EVENTS.GAME_START, { roomId: this.state.roomId })
    }
  }

  // ----------------------------------------------------------
  // playCard
  // ----------------------------------------------------------

  playCard(socket: Socket, playerId: string, card: number, pileId: string): void {
    const result = validateMove(this.state, { playerId, pileId, card })
    if (!result.valid || !result.delta) {
      socket.emit(EVENTS.ERROR, { message: result.error ?? "Coup invalide." })
      return
    }

    const player = this.state.players.find(p => p.id === playerId)!
    const pile   = this.state.piles.find(p => p.id === pileId)!

    const move: TurnMove = {
      card,
      pileId,
      previousTop: pile.top,
      wasOpponentPile: result.delta.isOpponentPile,
    }

    player.hand = player.hand.filter(c => c !== card)
    pile.top = result.delta.newTop
    this.state.cardsPlayedThisTurn += 1
    if (result.delta.isOpponentPile) this.state.playedOnOpponentThisTurn = true

    this.turnMoves[playerId] = [...(this.turnMoves[playerId] ?? []), move]

    this.emitToAll()
  }

  // ----------------------------------------------------------
  // undoCard — annule le dernier coup du tour en cours
  // Commun à tous les modes via IRoom
  // ----------------------------------------------------------

  undoCard(socket: Socket, playerId: string): void {
    if (this.state.currentPlayerId !== playerId) {
      socket.emit(EVENTS.ERROR, { message: "Ce n'est pas votre tour." })
      return
    }

    const moves = this.turnMoves[playerId] ?? []
    if (moves.length === 0) {
      socket.emit(EVENTS.ERROR, { message: "Aucun coup à annuler." })
      return
    }

    const lastMove = moves[moves.length - 1]!
    const pile     = this.state.piles.find(p => p.id === lastMove.pileId)!
    const player   = this.state.players.find(p => p.id === playerId)!

    pile.top     = lastMove.previousTop
    player.hand  = [...player.hand, lastMove.card]
    this.state.cardsPlayedThisTurn = Math.max(0, this.state.cardsPlayedThisTurn - 1)
    this.turnMoves[playerId] = moves.slice(0, -1)

    // Recalcule depuis l'historique restant — gère le missclick adverse
    this.state.playedOnOpponentThisTurn = this.turnMoves[playerId]!.some(m => m.wasOpponentPile)

    this.emitToAll()
  }

  // ----------------------------------------------------------
  // endTurn
  // ----------------------------------------------------------

  endTurn(socket: Socket, playerId: string): void {
    if (this.state.currentPlayerId !== playerId) {
      socket.emit(EVENTS.ERROR, { message: "Ce n'est pas votre tour." })
      return
    }

    const playerIndex = this.state.players.findIndex(p => p.id === playerId)
    const turnResult  = endTurn(this.state, playerIndex)

    if (turnResult.gameResult === "loss") {
      this.io.to(this.state.roomId).emit(EVENTS.GAME_OVER, { winnerId: null, reason: turnResult.reason })
      return
    }

    if (turnResult.gameResult === "win") {
      this.io.to(this.state.roomId).emit(EVENTS.GAME_OVER, { winnerId: playerId, reason: turnResult.reason ?? "victory" })
      return
    }

    this.applyDraw(playerId, turnResult.draws)
    this.advanceTurn(playerId)
    this.emitToAll()
  }

  // ----------------------------------------------------------
  // Privés
  // ----------------------------------------------------------

  private addSecondPlayer(playerId: string, pseudo: string, socketId: string): void {
    const playerIndex = this.state.players.length
    const deck = shuffle(Array.from({ length: 58 }, (_, i) => i + 2))
    const hand = drawCards(deck, HAND_SIZE)

    const newPlayer: Player = { id: playerId, pseudo, hand, deckSize: deck.length }
    this.state.players.push(newPlayer)
    this.state.piles.push(...createPlayerPiles(playerIndex))
    this.privateDecks[playerId] = deck
    this.socketIds[playerId] = socketId
    this.turnMoves[playerId] = []
  }

  private applyDraw(playerId: string, count: number): void {
    const player = this.state.players.find(p => p.id === playerId)!
    const deck   = this.privateDecks[playerId]!
    const drawn  = drawCards(deck, count)
    player.hand.push(...drawn)
    player.deckSize = deck.length
  }

  private advanceTurn(playerId: string): void {
    const next = this.state.players.find(p => p.id !== playerId)!
    this.state.currentPlayerId = next.id
    this.state.turnNumber += 1
    this.state.cardsPlayedThisTurn = 0
    this.state.playedOnOpponentThisTurn = false
    for (const id of Object.keys(this.turnMoves)) {
      this.turnMoves[id] = []
    }
  }

  private emitToAll(): void {
    for (const player of this.state.players) {
      const socketId = this.socketIds[player.id]
      if (!socketId) continue
      const target = this.io.sockets.sockets.get(socketId)
      if (!target?.connected) continue
      target.emit(EVENTS.GAME_STATE, buildPersonalizedState(this.state, this.privateDecks, player.id))
    }
  }
}
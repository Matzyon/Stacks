// ============================================================
// CoopRoom.ts — Room Socket.io pour le mode Coopératif
// Même structure que DuelRoom, adapté pour 2-6 joueurs
// ============================================================

import type { Server, Socket } from "socket.io"
import type { Move, GameState } from "./types"
import { EVENTS } from "./types"
import { GameEngine } from "./GameEngine"

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000

export class CoopRoom {
  private engine: GameEngine
  private sockets: Map<string, Socket> = new Map()
  private timers:  Map<string, ReturnType<typeof setTimeout>> = new Map()
  private io: Server

  constructor(io: Server, initialState: GameState) {
    this.io = io
    this.engine = new GameEngine(initialState)
  }

  join(socket: Socket, playerId: string) {
    this.sockets.set(playerId, socket)
    socket.join(this.engine.getSnapshot().roomId)
    this.resetTimer(playerId)

    // Snapshot complet à la connexion / reconnexion
    socket.emit(EVENTS.GAME_STATE, this.engine.getSnapshot())

    socket.on(EVENTS.PLAY_CARD, (move: Move) => this.onPlayCard(socket, move))
    socket.on(EVENTS.END_TURN,  ()           => this.onEndTurn(socket, playerId))
    socket.on(EVENTS.SIGNAL,    (data: { pile: number }) => this.onSignal(socket, playerId, data))
    socket.on("disconnect",     ()           => this.onDisconnect(playerId))
  }

  private onPlayCard(socket: Socket, move: Move) {
    this.resetTimer(move.playerId)

    const result = this.engine.playCard(move)

    if (!result.valid) {
      socket.emit(EVENTS.ERROR, result.error)
      return
    }

    this.io.to(this.engine.getSnapshot().roomId).emit(EVENTS.MOVE_RESULT, result.delta)
  }

  private onEndTurn(socket: Socket, playerId: string) {
    this.resetTimer(playerId)

    const result = this.engine.endTurn()

    this.io.to(this.engine.getSnapshot().roomId).emit(EVENTS.TURN_RESULT, result)

    if (result.gameResult !== "ongoing") {
      this.io.to(this.engine.getSnapshot().roomId).emit(EVENTS.GAME_OVER, result)
      this.cleanup()
    }
  }

  // Signal vague en coop ("attention à cette pile")
  // Pas de valeur de carte — juste un indice de pile
  private onSignal(socket: Socket, playerId: string, data: { pile: number }) {
    this.resetTimer(playerId)
    socket.to(this.engine.getSnapshot().roomId).emit(EVENTS.SIGNAL, {
      playerId,
      pile: data.pile,
    })
  }

  private onDisconnect(playerId: string) {
    this.sockets.delete(playerId)
    this.io.to(this.engine.getSnapshot().roomId).emit(EVENTS.PLAYER_LEFT, { playerId })
    this.startInactivityTimer(playerId)
  }

  private resetTimer(playerId: string) {
    const existing = this.timers.get(playerId)
    if (existing) clearTimeout(existing)
    this.startInactivityTimer(playerId)
  }

  private startInactivityTimer(playerId: string) {
    const timer = setTimeout(() => {
      this.io.to(this.engine.getSnapshot().roomId).emit(EVENTS.PLAYER_LEFT, { playerId, reason: "inactivity" })
      this.cleanup()
    }, INACTIVITY_TIMEOUT_MS)

    this.timers.set(playerId, timer)
  }

  private cleanup() {
    this.timers.forEach(t => clearTimeout(t))
    this.timers.clear()
  }
}

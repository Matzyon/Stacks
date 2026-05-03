// ============================================================
// DuelRoom.ts — Implémentation de IRoom pour le mode Duel
// Reçoit un GameState initial depuis factory.ts
// Gère les decks privés et les états personnalisés par joueur
// ============================================================

import { Server, Socket } from "socket.io"
import { EVENTS, DUEL_CONFIG } from "./types"
import type { GameState, Pile, Player } from "./types"
import type { IRoom } from "./IRoom"
import { validateMove, endTurn } from "./duel.rules"

const HAND_SIZE = DUEL_CONFIG.handSize // 6

// ------------------------------------------------------------
// Helpers locaux
// ------------------------------------------------------------

function shuffle(arr: number[]): number[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function createPlayerPiles(playerIndex: number): Pile[] {
  const prefix = `p${playerIndex}`
  return [
    { id: `${prefix}_asc`,  direction: "asc",  top: 1,  start: 1  },
    { id: `${prefix}_desc`, direction: "desc", top: 60, start: 60 },
  ]
}

function buildPersonalizedState(
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
      // Le joueur voit sa vraie main, l'adversaire voit des null
      hand: p.id === playerId ? p.hand : p.hand.map(() => null),
      deckSize: privateDecks[p.id]?.length ?? p.deckSize,
    })),
    piles: state.piles,
    currentPlayerId: state.currentPlayerId,
    turnNumber: state.turnNumber,
    cardsPlayedThisTurn: state.cardsPlayedThisTurn,
  }
}

// ------------------------------------------------------------
// DuelRoom
// ------------------------------------------------------------

export class DuelRoom implements IRoom {
  private state: GameState
  private io: Server
  // Decks privés stockés séparément — jamais envoyés au client
  private privateDecks: Record<string, number[]> = {}
  // Map playerId → socketId pour les émissions ciblées
  private socketIds: Record<string, string> = {}

  constructor(io: Server, initialState: GameState) {
    this.io = io
    this.state = initialState

    // Le joueur 1 est déjà dans le state (créé par factory.ts)
    // On reconstitue son deck privé : toutes les cartes 2→59
    // moins celles déjà distribuées en main
    for (const player of this.state.players) {
      const allCards = Array.from({ length: 58 }, (_, i) => i + 2)
      const inHand = new Set(player.hand)
      this.privateDecks[player.id] = shuffle(allCards.filter((c) => !inHand.has(c)))
    }
  }

  // ----------------------------------------------------------
  // join — joueur 1 (reconnexion) ou joueur 2 (nouveau)
  // ----------------------------------------------------------

  join(socket: Socket, playerId: string, pseudo: string): void {
    const existing = this.state.players.find((p) => p.id === playerId)

    if (existing) {
      // Joueur connu : reconnexion ou joueur 1 qui vient de créer la room
      // On met juste à jour son socketId
      existing.pseudo = pseudo
      this.socketIds[playerId] = socket.id
    } else {
      // Joueur 2 : créer sa pioche et ses piles
      const playerIndex = this.state.players.length // 1 en mode duel
      const allCards = Array.from({ length: 58 }, (_, i) => i + 2)
      const deck = shuffle(allCards)
      const hand = deck.splice(0, HAND_SIZE)

      const newPlayer: Player = {
        id: playerId,
        pseudo,
        hand,
        deckSize: deck.length,
      }

      this.state.players.push(newPlayer)
      this.state.piles.push(...createPlayerPiles(playerIndex))
      this.privateDecks[playerId] = deck
      this.socketIds[playerId] = socket.id
    }

    socket.join(this.state.roomId)
    this.emitToAll()

    // Démarrer la partie quand les 2 joueurs sont connectés
    if (this.state.players.length === 2) {
      this.io.to(this.state.roomId).emit(EVENTS.GAME_START, {
        roomId: this.state.roomId,
      })
    }
  }

  // ----------------------------------------------------------
  // playCard — poser une carte sur une pile
  // ----------------------------------------------------------

  playCard(socket: Socket, playerId: string, card: number, pileId: string): void {
  const result = validateMove(this.state, { playerId, pileId, card })
  console.log("[playCard] validateMove result:", JSON.stringify(result))
    if (!result.valid || !result.delta) {
      socket.emit(EVENTS.ERROR, { message: result.error ?? "Coup invalide." })
      return
    }

    const player = this.state.players.find((p) => p.id === playerId)!
    console.log("[playCard] main du joueur:", player?.hand)
    const pile = this.state.piles.find((p) => p.id === pileId)!

    player.hand = player.hand.filter((c) => c !== card)
    pile.top = result.delta.newTop
    this.state.cardsPlayedThisTurn += 1

    if (result.delta.isOpponentPile) {
      this.state.playedOnOpponentThisTurn = true
    }

    this.emitToAll()
  }

  // ----------------------------------------------------------
  // endTurn — fin de tour, pioche, passage au joueur suivant
  // ----------------------------------------------------------

  endTurn(socket: Socket, playerId: string): void {
    if (this.state.currentPlayerId !== playerId) {
      socket.emit(EVENTS.ERROR, { message: "Ce n'est pas votre tour." })
      return
    }

    const playerIndex = this.state.players.findIndex((p) => p.id === playerId)
    const turnResult = endTurn(this.state, playerIndex)

    if (turnResult.gameResult === "loss") {
      this.io.to(this.state.roomId).emit(EVENTS.GAME_OVER, {
        winnerId: null,
        reason: turnResult.reason,
      })
      return
    }

    if (turnResult.gameResult === "win") {
      this.io.to(this.state.roomId).emit(EVENTS.GAME_OVER, {
        winnerId: playerId,
        reason: turnResult.reason ?? "victory",
      })
      return
    }

    // Piocher selon le résultat du tour
    const player = this.state.players.find((p) => p.id === playerId)!
    const deck = this.privateDecks[playerId]!
    const drawn = deck.splice(0, turnResult.draws)
    player.hand.push(...drawn)
    player.deckSize = deck.length

    // Passer au joueur suivant
    const nextPlayer = this.state.players.find((p) => p.id !== playerId)!
    this.state.currentPlayerId = nextPlayer.id
    this.state.turnNumber += 1
    this.state.cardsPlayedThisTurn = 0
    this.state.playedOnOpponentThisTurn = false

    this.emitToAll()
  }

  // ----------------------------------------------------------
  // emitToAll — envoie un état personnalisé à chaque joueur
  // ----------------------------------------------------------
private emitToAll(): void {
  for (const player of this.state.players) {
    const socketId = this.socketIds[player.id]
    if (!socketId) continue
    const targetSocket = this.io.sockets.sockets.get(socketId)
    if (!targetSocket?.connected) continue  // ← skip si déconnecté
    const personalizedState = buildPersonalizedState(
      this.state,
      this.privateDecks,
      player.id
    )
    targetSocket.emit(EVENTS.GAME_STATE, personalizedState)
  }
}

}
// ============================================================
// IRoom.ts — Contrat commun à toutes les rooms de jeu
// Toute nouvelle room (Duel, Coop, Custom...) doit implémenter
// cette interface. index.ts ne connaît QUE IRoom.
// ============================================================

import type { Socket } from "socket.io"

export interface IRoom {
  // Appelé quand un joueur rejoint ou se reconnecte
  join(socket: Socket, playerId: string, pseudo: string): void

  // Appelé quand un joueur pose une carte
  playCard(socket: Socket, playerId: string, card: number, pileId: string): void

  // Appelé quand un joueur termine son tour
  endTurn(socket: Socket, playerId: string): void

  // Nombre de joueurs actuellement dans la room
  readonly playerCount: number
}
// __tests__/duel.test.ts
import { describe, it, expect } from "bun:test"
import { isValidMove, isRewind } from "../core.rules"
import { canPlayOnOpponentPile, validateMove, endTurn } from "../duel.rules"
import type { Pile, GameState } from "../types"

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function makePile(id: string, direction: "asc" | "desc", top: number): Pile {
  return { id, direction, top, start: direction === "asc" ? 1 : 60 }
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: "test",
    mode: "duel",
    players: [
      { id: "p0", pseudo: "Alice", hand: [15, 20, 30], deckSize: 10 },
      { id: "p1", pseudo: "Bob",   hand: [5, 40, 55],  deckSize: 10 },
    ],
    piles: [
      makePile("p0_asc",  "asc",  1),
      makePile("p0_desc", "desc", 60),
      makePile("p1_asc",  "asc",  1),
      makePile("p1_desc", "desc", 60),
    ],
    currentPlayerId: "p0",
    turnNumber: 1,
    cardsPlayedThisTurn: 0,
    playedOnOpponentThisTurn: false,
    result: "ongoing",
    startedAt: Date.now(),
    ...overrides,
  }
}

// ------------------------------------------------------------
// core : isRewind
// ------------------------------------------------------------

describe("isRewind", () => {
  it("détecte un recul sur pile ascendante (sommet - 10)", () => {
    const pile = makePile("p0_asc", "asc", 30)
    expect(isRewind(pile, 20)).toBe(true)
  })

  it("détecte un recul sur pile descendante (sommet + 10)", () => {
    const pile = makePile("p0_desc", "desc", 40)
    expect(isRewind(pile, 50)).toBe(true)
  })

  it("retourne false si ce n'est pas exactement -10 / +10", () => {
    const pile = makePile("p0_asc", "asc", 30)
    expect(isRewind(pile, 19)).toBe(false)
    expect(isRewind(pile, 21)).toBe(false)
  })
})

// ------------------------------------------------------------
// core : isValidMove
// ------------------------------------------------------------

describe("isValidMove", () => {
  it("accepte une carte supérieure sur pile ascendante", () => {
    const pile = makePile("p0_asc", "asc", 10)
    expect(isValidMove(pile, 11)).toBe(true)
  })

  it("refuse une carte inférieure sur pile ascendante", () => {
    const pile = makePile("p0_asc", "asc", 10)
    expect(isValidMove(pile, 9)).toBe(false)
  })

  it("accepte le recul exact sur pile ascendante", () => {
    const pile = makePile("p0_asc", "asc", 30)
    expect(isValidMove(pile, 20)).toBe(true)
  })

  it("accepte une carte inférieure sur pile descendante", () => {
    const pile = makePile("p0_desc", "desc", 50)
    expect(isValidMove(pile, 49)).toBe(true)
  })

  it("refuse une carte égale au sommet", () => {
    const pile = makePile("p0_asc", "asc", 10)
    expect(isValidMove(pile, 10)).toBe(false)
  })
})

// ------------------------------------------------------------
// duel : canPlayOnOpponentPile
// ------------------------------------------------------------

describe("canPlayOnOpponentPile", () => {
  it("autorise uniquement le recul exact", () => {
    const pile = makePile("p1_asc", "asc", 30)
    expect(canPlayOnOpponentPile(pile, 20)).toBe(true)
    expect(canPlayOnOpponentPile(pile, 35)).toBe(false)
  })
})

// ------------------------------------------------------------
// duel : validateMove
// ------------------------------------------------------------

describe("validateMove", () => {
  it("refuse si ce n'est pas le bon joueur", () => {
    const state = makeState()
    const result = validateMove(state, { playerId: "p1", pileId: "p1_asc", card: 5 })
    expect(result.valid).toBe(false)
    expect(result.error).toBe("not_your_turn")
  })

  it("refuse si la carte n'est pas en main", () => {
    const state = makeState()
    const result = validateMove(state, { playerId: "p0", pileId: "p0_asc", card: 99 })
    expect(result.valid).toBe(false)
    expect(result.error).toBe("card_not_in_hand")
  })

  it("accepte un coup valide sur sa propre pile", () => {
    const state = makeState()
    const result = validateMove(state, { playerId: "p0", pileId: "p0_asc", card: 15 })
    expect(result.valid).toBe(true)
    expect(result.delta?.newTop).toBe(15)
  })

  it("refuse un coup invalide sur pile adverse (pas un recul)", () => {
    const state = makeState()
    const result = validateMove(state, { playerId: "p0", pileId: "p1_asc", card: 15 })
    expect(result.valid).toBe(false)
    expect(result.error).toBe("cannot_play_on_opponent_pile")
  })
})

// ------------------------------------------------------------
// duel : endTurn
// ------------------------------------------------------------

describe("endTurn", () => {
  it("défaite si moins de 2 cartes jouées", () => {
    const state = makeState({ cardsPlayedThisTurn: 1 })
    const result = endTurn(state, 0)
    expect(result.gameResult).toBe("loss")
    expect(result.reason).toBe("min_cards_not_met")
  })

  it("pioche 2 cartes si joué uniquement sur ses piles", () => {
    const state = makeState({ cardsPlayedThisTurn: 2, playedOnOpponentThisTurn: false })
    const result = endTurn(state, 0)
    expect(result.draws).toBe(2)
    expect(result.gameResult).toBe("ongoing")
  })

  it("victoire si l'adversaire est bloqué", () => {
    const state = makeState({
      cardsPlayedThisTurn: 2,
      players: [
        { id: "p0", pseudo: "Alice", hand: [], deckSize: 5 },
        { id: "p1", pseudo: "Bob",   hand: [30, 31], deckSize: 5 },
      ],
      piles: [
        makePile("p0_asc",  "asc",  1),
        makePile("p0_desc", "desc", 60),
        makePile("p1_asc",  "asc",  50),   // Bob ne peut pas jouer 30 ou 31 ici
        makePile("p1_desc", "desc", 10),   // ni ici
      ],
    })
    const result = endTurn(state, 0)
    expect(result.gameResult).toBe("win")
    expect(result.reason).toBe("opponent_blocked")
  })
})

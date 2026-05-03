// ============================================================
// core.rules.ts — Règles communes Duel & Coop
// Fonctions pures : pas d'état, pas d'effet de bord
// ============================================================

import type { Pile, CardValue } from "./types"

// ------------------------------------------------------------
// isRewind
// Vérifie si une carte applique la règle du recul :
//   - Pile ascendante  : carte === sommet - 10
//   - Pile descendante : carte === sommet + 10
// ------------------------------------------------------------

export function isRewind(pile: Pile, card: CardValue): boolean {
  if (pile.direction === "asc") {
    return card === pile.top - 10
  } else {
    return card === pile.top + 10
  }
}

// ------------------------------------------------------------
// isValidMove
// Un coup est valide si :
//   1. La carte respecte l'ordre de la pile (strictement), OU
//   2. C'est un recul exact (-10 / +10)
// ------------------------------------------------------------

export function isValidMove(pile: Pile, card: CardValue): boolean {
  if (isRewind(pile, card)) return true

  if (pile.direction === "asc") {
    return card > pile.top
  } else {
    return card < pile.top
  }
}

// ------------------------------------------------------------
// applyCard
// Applique une carte sur une pile et retourne le nouveau sommet.
// Ne modifie PAS la pile directement — retourne la nouvelle valeur.
// C'est la Room qui fait la mutation sur le GameState.
// ------------------------------------------------------------

export function applyCard(pile: Pile, card: CardValue): CardValue {
  // La valeur du sommet devient simplement la carte jouée
  return card
}

// ------------------------------------------------------------
// isGameWinnable (guard rapide)
// Vérifie si au moins une carte d'une main est jouable sur
// au moins une pile. Utilisé pour détecter le blocage.
// ------------------------------------------------------------

export function hasPlayableCard(hand: CardValue[], piles: Pile[]): boolean {
  return hand.some(card =>
    piles.some(pile => isValidMove(pile, card))
  )
}

// ------------------------------------------------------------
// canMeetMinimum
// Vérifie si le joueur peut poser au moins `min` cartes
// sur les piles disponibles.
// Utilisé en début de tour pour détecter la défaite immédiate.
// ------------------------------------------------------------

export function canMeetMinimum(
  hand: CardValue[],
  piles: Pile[],
  min: number
): boolean {
  let playableCount = 0

  for (const card of hand) {
    for (const pile of piles) {
      if (isValidMove(pile, card)) {
        playableCount++
        break // cette carte est jouable, on passe à la suivante
      }
    }
    if (playableCount >= min) return true
  }

  return false
}

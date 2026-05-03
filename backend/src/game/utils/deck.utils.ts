// ============================================================
// deck.utils.ts — Utilitaires de pioche
// Stacks — v1.0
// ============================================================

/**
 * Mélange un tableau de nombres (Fisher-Yates).
 * Retourne un nouveau tableau, n'altère pas l'original.
 */
export function shuffle(arr: number[]): number[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/**
 * Génère un deck Duel : cartes 2→59 (1 et 60 sont les bases des piles).
 * Retourne le deck mélangé.
 */
export function createDuelDeck(): number[] {
  return shuffle(Array.from({ length: 58 }, (_, i) => i + 2))
}

/**
 * Pioche n cartes depuis un deck privé.
 * Modifie le deck en place, retourne les cartes piochées.
 */
export function drawCards(deck: number[], count: number): number[] {
  return deck.splice(0, count)
}

/**
 * Calcule combien de cartes piocher en fin de tour (mode Duel).
 * - Si le joueur a joué sur une pile adverse → compléter à 6
 * - Sinon → piocher 2
 */
export function computeDrawCount(
  handSize: number,
  targetHandSize: number,
  playedOnOpponent: boolean,
  drawSolo: number
): number {
  if (playedOnOpponent) return Math.max(0, targetHandSize - handSize)
  return drawSolo
}
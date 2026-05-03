import { useState } from "react";
import { useGameStore } from "../useGameStore";
import { socket } from "../socket";

const EVENTS = {
  PLAY_CARD: "play_card",
  END_TURN:  "end_turn",
} as const;

// ------------------------------------------------------------
// canPlayOnPile
// isOwn = true  → règle standard (strictement sup/inf) + recul exact (-10/+10)
// isOwn = false → règle adverse : carte INFÉRIEURE sur asc, SUPÉRIEURE sur desc
// ⚠️ Ne pas utiliser isRewind ici pour les piles adverses
// ------------------------------------------------------------
function canPlayOnPile(
  card: number,
  pile: { top: number; direction: "asc" | "desc" },
  isOwn: boolean
): boolean {
  if (isOwn) {
    if (pile.direction === "asc") return card > pile.top || card === pile.top - 10;
    return card < pile.top || card === pile.top + 10;
  } else {
    if (pile.direction === "asc") return card < pile.top;
    return card > pile.top;
  }
}

function PileCard({
  pile, isOwn, isPlayable, isOpponentBlocked, selectedCard, onPlay,
}: {
  pile: { id: string; direction: "asc" | "desc"; top: number; start: number };
  isOwn: boolean;
  isPlayable: boolean;
  isOpponentBlocked: boolean;
  selectedCard: number | null;
  onPlay: (pileId: string) => void;
}) {
  const label = pile.direction === "asc" ? "▲" : "▼";
  const range = pile.direction === "asc" ? `${pile.start} → 59` : `60 → ${pile.start}`;
  const blocked = !isOwn && isOpponentBlocked;
  const clickable = selectedCard !== null && isPlayable && !blocked;

  let borderClass = isOwn ? "border-slate-600" : "border-rose-800";
  let bgClass = isOwn ? "bg-slate-800" : "bg-rose-950";

  if (selectedCard !== null) {
    if (blocked) {
      borderClass = "border-slate-700 opacity-40";
    } else if (isPlayable) {
      borderClass = "border-emerald-400 ring-2 ring-emerald-400/30";
      bgClass = isOwn ? "bg-slate-700" : "bg-rose-900";
    } else {
      borderClass = isOwn ? "border-slate-700 opacity-50" : "border-rose-900 opacity-40";
    }
  }

  return (
    <button
      onClick={() => clickable && onPlay(pile.id)}
      disabled={!clickable}
      className={[
        "flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-150 p-3 min-w-[88px] min-h-[108px] select-none",
        bgClass, borderClass,
        clickable ? "cursor-pointer hover:scale-105" : "cursor-default",
      ].join(" ")}
    >
      <span className="text-2xl font-bold">{pile.top}</span>
      <span className="text-[10px] opacity-50 mt-1">{label} {range}</span>
      <span className="text-[10px] mt-1 opacity-40">{isOwn ? "moi" : "adv."}</span>
    </button>
  );
}

function HandCard({
  value, isSelected, onSelect, isMyTurn,
}: {
  value: number;
  isSelected: boolean;
  onSelect: () => void;
  isMyTurn: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={!isMyTurn}
      className={[
        "flex items-center justify-center rounded-xl border-2 transition-all duration-150 w-14 h-20 text-xl font-bold select-none",
        isSelected
          ? "bg-yellow-400 border-yellow-300 text-slate-900 scale-110 shadow-lg shadow-yellow-400/20"
          : "bg-slate-700 border-slate-500 text-white",
        isMyTurn ? "cursor-pointer hover:border-yellow-400 hover:scale-105" : "cursor-default opacity-50",
      ].join(" ")}
    >
      {value}
    </button>
  );
}

function DeckButton({
  deckSize, canEndTurn, isMyTurn, onEndTurn,
}: {
  deckSize: number;
  canEndTurn: boolean;
  isMyTurn: boolean;
  onEndTurn: () => void;
}) {
  if (!isMyTurn) {
    return (
      <div className="flex flex-col items-center justify-center w-14 h-20 rounded-xl border-2 border-slate-700 bg-slate-800 text-slate-500 select-none">
        <span className="text-lg">🂠</span>
        <span className="text-[10px] mt-1">{deckSize}</span>
      </div>
    );
  }
  return (
    <button
      onClick={canEndTurn ? onEndTurn : undefined}
      disabled={!canEndTurn}
      className={[
        "flex flex-col items-center justify-center w-14 h-20 rounded-xl border-2 transition-all duration-150 select-none",
        canEndTurn
          ? "bg-yellow-400 border-yellow-300 text-slate-900 cursor-pointer hover:scale-105 hover:bg-yellow-300 shadow-lg shadow-yellow-400/20"
          : "bg-slate-800 border-slate-600 text-slate-400 cursor-not-allowed opacity-60",
      ].join(" ")}
      title={canEndTurn ? "Cliquer pour finir le tour" : "Posez encore des cartes"}
    >
      <span className="text-lg">{canEndTurn ? "✓" : "🂠"}</span>
      <span className="text-[10px] mt-1 font-medium">{deckSize}</span>
      {canEndTurn && <span className="text-[9px] mt-0.5">fin tour</span>}
    </button>
  );
}

export default function Duel() {
  const gameState    = useGameStore((s) => s.gameState);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const clearError   = useGameStore((s) => s.clearError);
  const playerId     = useGameStore((s) => s.playerId);

  const [selectedCard,     setSelectedCard]    = useState<number | null>(null);
  const [playedOnOpponent, setPlayedOnOpponent] = useState(false);

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">🃏</div>
          <p className="text-slate-400">En attente de l'adversaire…</p>
        </div>
      </div>
    );
  }

  const { roomId, players, piles, currentPlayerId, cardsPlayedThisTurn } = gameState;

  const isMyTurn  = currentPlayerId === playerId;
  const myIndex   = players.findIndex((p) => p.id === playerId);
  const myPrefix  = `p${myIndex}_`;

  const myPlayer      = players.find((p) => p.id === playerId);
  const opponent      = players.find((p) => p.id !== playerId);
  const myHand        = (myPlayer?.hand ?? []).filter((c): c is number => c !== null);
  const myPiles       = piles.filter((p) => p.id.startsWith(myPrefix));
  const opponentPiles = piles.filter((p) => !p.id.startsWith(myPrefix));
  const canEndTurn    = cardsPlayedThisTurn >= 2;

  function handleSelectCard(card: number) {
    if (!isMyTurn) return;
    setSelectedCard((prev) => (prev === card ? null : card));
  }

  function handlePlayCard(pileId: string) {
    if (selectedCard === null || !isMyTurn) return;
    const isOpponent = !pileId.startsWith(myPrefix);
    if (isOpponent && playedOnOpponent) return;

    socket.emit(EVENTS.PLAY_CARD, { roomId, playerId, card: selectedCard, pileId });
    if (isOpponent) setPlayedOnOpponent(true);
    setSelectedCard(null);
  }

  function handleEndTurn() {
    if (!canEndTurn || !isMyTurn) return;
    socket.emit(EVENTS.END_TURN, { roomId, playerId });
    setSelectedCard(null);
    setPlayedOnOpponent(false);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">

      {errorMessage && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-700 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 cursor-pointer"
          onClick={clearError}
        >
          <span>⚠️</span>
          <span className="text-sm">{errorMessage}</span>
          <span className="opacity-60 text-xs ml-2">× fermer</span>
        </div>
      )}

      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
        <div className="text-sm text-slate-400">
          Tour <span className="text-white font-medium">{gameState.turnNumber}</span>
        </div>
        <div className="text-xs font-mono tracking-widest text-slate-500">{roomId}</div>
        <div className="text-sm font-medium">
          {isMyTurn
            ? <span className="text-yellow-400">🟡 Votre tour</span>
            : <span className="text-slate-400">⌛ {opponent?.pseudo}</span>
          }
        </div>
        <div className="text-sm text-slate-400">{cardsPlayedThisTurn}/2 posées</div>
      </header>

      {/* Zone adverse */}
      <section className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-rose-700 flex items-center justify-center text-xs font-bold">
              {opponent?.pseudo?.[0]?.toUpperCase() ?? "?"}
            </div>
            <span className="text-sm font-medium text-rose-300">
              {opponent?.pseudo ?? "Adversaire"}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            {opponent?.deckSize ?? 0} en pioche · {opponent?.hand?.length ?? 0} en main
          </span>
        </div>
        <div className="flex gap-3 justify-center">
          {opponentPiles.map((pile) => (
            <PileCard
              key={pile.id}
              pile={pile}
              isOwn={false}
              isPlayable={selectedCard !== null && canPlayOnPile(selectedCard, pile, false)}
              isOpponentBlocked={playedOnOpponent}
              selectedCard={selectedCard}
              onPlay={handlePlayCard}
            />
          ))}
        </div>
      </section>

      <div className="flex items-center justify-center py-2 text-slate-700 text-xs tracking-widest">
        ── PILES ──
      </div>

      {/* Mes piles */}
      <section className="px-5 py-4 border-t border-slate-800">
        <div className="flex gap-3 justify-center mb-2">
          {myPiles.map((pile) => (
            <PileCard
              key={pile.id}
              pile={pile}
              isOwn={true}
              isPlayable={selectedCard !== null && canPlayOnPile(selectedCard, pile, true)}
              isOpponentBlocked={false}
              selectedCard={selectedCard}
              onPlay={handlePlayCard}
            />
          ))}
        </div>
        <div className="text-center text-xs text-slate-500">Vos piles</div>
      </section>

      {/* Main + pioche */}
      <section className="px-5 pb-6 flex-1">
        <div className="text-xs text-slate-500 mb-2">
          Votre main
          {selectedCard !== null && (
            <span className="ml-2 text-yellow-400">
              — carte {selectedCard} sélectionnée, cliquez une pile verte
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <DeckButton
            deckSize={myPlayer?.deckSize ?? 0}
            canEndTurn={canEndTurn}
            isMyTurn={isMyTurn}
            onEndTurn={handleEndTurn}
          />
          <div className="w-px h-16 bg-slate-700 mx-1" />
          {myHand.map((card) => (
            <HandCard
              key={card}
              value={card}
              isSelected={selectedCard === card}
              onSelect={() => handleSelectCard(card)}
              isMyTurn={isMyTurn}
            />
          ))}
        </div>
        {isMyTurn && !canEndTurn && (
          <p className="text-xs text-slate-600 mt-3">
            Posez encore {2 - cardsPlayedThisTurn} carte(s) pour pouvoir finir le tour
          </p>
        )}
      </section>
    </div>
  );
}
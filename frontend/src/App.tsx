import { useGameStore } from './useGameStore'
import Lobby from './components/Lobby'
import Duel from './components/Duel'

export default function App() {
  const phase     = useGameStore((s) => s.phase)
  const gameState = useGameStore((s) => s.gameState)
  console.log("App render", phase, gameState?.cardsPlayedThisTurn)

  if (phase === 'lobby' || phase === 'waiting') return <Lobby />
  if (phase === 'game') return <Duel />

  return <div className="text-white p-8">Phase: {phase}</div>
}
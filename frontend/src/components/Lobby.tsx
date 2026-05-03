import { useState } from 'react'
import { useGameStore } from '../useGameStore'
export default function Lobby() {
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const { pseudo, roomCode, mode, error, phase,
          setPseudo, setRoomCode, setMode, createRoom, joinRoom } = useGameStore()
  const isWaiting = phase === 'waiting'

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center font-mono">
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-10 w-[360px] flex flex-col gap-5">

        <div className="text-center">
          <h1 className="text-5xl tracking-[8px] text-[#e8c547] font-bold">THE GAME</h1>
          <p className="text-[#47b8e8] tracking-[12px] text-lg">DUEL</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] tracking-widest text-[#666]">TON PSEUDO</label>
          <input
            className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-md text-white px-3 py-2 font-mono text-base outline-none"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="ex: Julien"
            maxLength={20}
            disabled={isWaiting}
          />
        </div>

        <div className="flex gap-1 bg-[#0d0d0d] rounded-lg p-1">
          {(['create', 'join'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-md text-[11px] tracking-widest transition-colors
                ${tab === t ? 'bg-[#1e1e1e] text-white' : 'text-[#666]'}`}
            >
              {t === 'create' ? 'CRÉER' : 'REJOINDRE'}
            </button>
          ))}
        </div>

        {tab === 'create' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] tracking-widest text-[#666]">MODE</label>
              <div className="flex gap-2">
                {(['duel', 'coop'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2 rounded-md border text-[11px] tracking-widest transition-colors
                      ${mode === m ? 'border-[#e8c547] text-[#e8c547]' : 'border-[#2a2a2a] text-[#666]'}`}
                  >
                    {m === 'duel' ? '⚔️ DUEL' : '🤝 COOP'}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={createRoom}
              disabled={isWaiting || !pseudo.trim()}
              className="bg-[#e8c547] text-[#0d0d0d] font-bold py-3 rounded-md text-[12px] tracking-widest disabled:opacity-50"
            >
              {isWaiting ? 'EN ATTENTE...' : 'CRÉER LA PARTIE'}
            </button>
          </div>
        )}

        {tab === 'join' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] tracking-widest text-[#666]">CODE DE LA PARTIE</label>
              <input
                className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-md text-white px-3 py-2 font-mono text-2xl text-center tracking-[8px] outline-none"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="XXXX"
                maxLength={6}
                disabled={isWaiting}
              />
            </div>
            <button
              onClick={joinRoom}
              disabled={isWaiting || !pseudo.trim() || !roomCode.trim()}
              className="bg-[#47b8e8] text-[#0d0d0d] font-bold py-3 rounded-md text-[12px] tracking-widest disabled:opacity-50"
            >
              {isWaiting ? 'CONNEXION...' : 'REJOINDRE'}
            </button>
          </div>
        )}

        {isWaiting && roomCode && (
          <div className="bg-[#0d0d0d] rounded-lg p-3 text-center text-sm text-[#666]">
            En attente d'un adversaire…
            <div className="text-white text-lg tracking-[6px] mt-1">{roomCode}</div>
          </div>
        )}

        {error && (
          <div className="bg-[#2a0d0d] border border-[#e84747] rounded-md px-3 py-2 text-[#e84747] text-xs">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
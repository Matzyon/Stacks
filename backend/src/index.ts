// ============================================================
// index.ts — Serveur Express + Socket.io
// Stacks — v1.0
// Ne connaît que IRoom — jamais DuelRoom ou CoopRoom directement
// Pour ajouter un mode : 1 ligne dans createRoom()
// ============================================================

import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import { DuelRoom } from "./game/DuelRoom"
import { CoopRoom } from "./game/CoopRoom"
import { createInitialState } from "./game/factory"
import type { IRoom } from "./game/IRoom"
import type { GameMode } from "./game/types"

const app  = express()
const http = createServer(app)
const io   = new Server(http, {
  cors: { origin: process.env.FRONTEND_URL ?? "http://localhost:5173" },
  pingTimeout:  60000,
  pingInterval: 25000,
  transports: ["websocket"],
})

app.use(cors())
app.use(express.json())

const rooms = new Map<string, IRoom>()

function createRoom(io: Server, mode: GameMode, initialState: any): IRoom {
  switch (mode) {
    case "duel": return new DuelRoom(io, initialState)
    case "coop": return new CoopRoom(io, initialState)
    default: throw new Error(`Mode inconnu : ${mode}`)
  }
}

app.post("/game/create", (req, res) => {
  const { mode, pseudo } = req.body as { mode: GameMode; pseudo: string }
  if (!mode || !pseudo?.trim()) {
    res.status(400).json({ error: "mode et pseudo requis" })
    return
  }
  const roomId       = Math.random().toString(36).slice(2, 8).toUpperCase()
  const playerId     = crypto.randomUUID()
  const initialState = createInitialState(roomId, mode, playerId, pseudo)
  const room         = createRoom(io, mode, initialState)
  rooms.set(roomId, room)
  console.log(`[room] créée ${roomId} (${mode}) par ${pseudo}`)
  res.json({ roomId, playerId })
})

io.engine.on("connection_error", (err) => {
  console.log("[engine error]", err.code, err.message, err.context)
})

io.on("connection", (socket) => {
  console.log(`[socket] connecté ${socket.id}`)

  socket.on("join_room", ({ roomId, playerId, pseudo }: {
    roomId: string; playerId: string; pseudo: string
  }) => {
    console.log(`[join_room] roomId=${roomId} playerId=${playerId} pseudo=${pseudo}`)
    const room = rooms.get(roomId)
    if (!room) { socket.emit("error", { message: "room_not_found" }); return }
    room.join(socket, playerId, pseudo)
  })

  socket.on("play_card", ({ roomId, playerId, card, pileId }: {
    roomId: string; playerId: string; card: number; pileId: string
  }) => {
    console.log(`[play_card] room=${roomId} player=${playerId} card=${card} pile=${pileId}`)
    const room = rooms.get(roomId)
    if (!room) return
    room.playCard(socket, playerId, card, pileId)
  })

  socket.on("undo_card", ({ roomId, playerId }: {
    roomId: string; playerId: string
  }) => {
    console.log(`[undo_card] room=${roomId} player=${playerId}`)
    const room = rooms.get(roomId)
    if (!room) return
    room.undoCard(socket, playerId)
  })

  socket.on("end_turn", ({ roomId, playerId }: {
    roomId: string; playerId: string
  }) => {
    console.log(`[end_turn] room=${roomId} player=${playerId}`)
    const room = rooms.get(roomId)
    if (!room) return
    room.endTurn(socket, playerId)
  })

  socket.on("disconnect", () => {
    console.log(`[socket] déconnecté ${socket.id}`)
  })
})

const PORT = process.env.PORT ?? 3001
http.listen(PORT, () => console.log(`Server running on port ${PORT}`))
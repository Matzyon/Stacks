import { io } from 'socket.io-client'

const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export const socket = io(URL, {
  autoConnect: false,
  transports: ['websocket'], // websocket pur — pas de polling HTTP
})

// Empêche Vite HMR de recharger ce module
// Sans ça, un nouveau socket est créé à chaque sauvegarde → boucle de reconnexion
if (import.meta.hot) {
  import.meta.hot.decline()
}
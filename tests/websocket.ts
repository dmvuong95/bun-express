import express from '../index'

const app = express<{ userId?: string }>()

declare global {
  interface Request {
    userId?: string
  }
}

app.router.use(
  // Session middleware
  (req, res, next) => {
    const cookie = req.headers.get('cookie')
    console.log('Session Middleware:', cookie)
    req.userId = cookie?.match(/sessionId=(\w+)/)?.[1]
    setTimeout(next, 10)
  }
)
app.websocket({
  path: '/ws',
  getUpgradeOptions(req) {
    return {
      data: {
        userId: req.userId,
      },
    }
  },
  message(ws, message) {
    console.log('Session:', ws.data.userId, ', Message:', message)
    ws.send('Hi')
  },
  open(ws) {
    console.log('Connected:', ws.data.userId)
  },
  close(ws, code, reason) {
    console.log('Disconnected:', ws.data.userId, code, reason)
  },
})

app.listen(3000)

// Client
await new Promise(resolve => setTimeout(resolve, 2000))
const sessionId = '123'
const socketClient = new WebSocket('ws://localhost:3000/ws', {
  headers: {
    cookie: `sessionId=${sessionId}`,
  },
})
socketClient.addEventListener('open', () => {
  console.log('Connected')
  socketClient.send('Hello')
})
socketClient.addEventListener('message', event => {
  console.log('socketClient received message:', event.data)
})

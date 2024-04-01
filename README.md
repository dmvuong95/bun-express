# `bun-express`

A simple [express.js](https://expressjs.com) wrapper for [bun](https://bun.sh)

## Installation

```bash
npm install bun-express
```

## Usage

### Basic Usage

```typescript
import express, { type ErrorRequestHandler } from 'bun-express'

const app = express()

// Use middleware
app.router.use((req, res, next) => {
  console.log('Request received')
  next()
})

// Define a route handler
app.router.post('/', async (req, res) => {
  const body = await req.json()
  res.setJsonBody({ message: 'Hello, World!' }).close()
})

// Use error handler
app.router.use(((err, req, res, next) => {
  console.error(err)
  res.setStatusCode(500).setTextBody('Internal Server Error').close()
}) as ErrorRequestHandler)

// Nested routers
const router = express.Router()
router.get('/bar', (req, res) => {
  res.setJsonBody({ message: 'Hello, Bar!' }).close()
})
router.get('/baz', (req, res) => {
  const file = Bun.file('./baz.jpg')
  res.setBlobBody(file).close()
})
app.router.use('/foo', router)

// Implement stream api
app.router.get('/stream', async (req, res) => {
  const writer = res.getWriter()
  await writer.ready
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  await writer.write(JSON.stringify({ message: 'Hello' }))
  await writer.close()
})
app.router.get('/stream2', async (req, res) => {
  const file = Bun.file('./image.jpg')
  res.setHeader('Content-Type', file.type)
  const stream = file.stream()
  stream.pipeTo(res)
})

// Start the server
app.listen(3000)
```

### Websocket

Server:

```typescript
import express from 'bun-express'

const app = express()

declare global {
  interface Request {
    userId?: string
  }
}

app.router.use(
  // Session middleware
  (req, res, next) => {
    const cookie = req.headers.get('cookie')
    req.userId = cookie?.match(/sessionId=(\w+)/)?.[1]
    next()
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
    console.log('UserId:', ws.data.userId, ', Message:', message)
    ws.send('Hi')
  },
  open(ws) {
    console.log('UserId connected:', ws.data.userId)
  },
  close(ws, code, reason) {
    console.log('UserId disconnected:', ws.data.userId, code, reason)
  },
})

app.listen(3000)
```

Browser client:

```typescript
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
```

# License

MIT

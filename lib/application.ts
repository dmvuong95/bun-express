import * as Bun from 'bun'
import * as qs from 'node:querystring'
import { Router, type RequestHandler } from './router'
import { Response } from './response'

interface WebSocketUpgradeOptions<T = unknown> {
  headers?: globalThis.Bun.HeadersInit
  data?: T
}

interface WebSocketHandler<T = unknown> extends Bun.WebSocketHandler<T> {
  /**
   * Path to upgrade WebSocket connection.
   * @default '/ws'
   */
  path?: string | RegExp
  /**
   * Provide method to get WebSocket upgrade options.
   */
  getUpgradeOptions?(
    req: Request
  ): WebSocketUpgradeOptions<T> | PromiseLike<WebSocketUpgradeOptions<T>>
}

const websocketUpgradeRequestHandler: RequestHandler = async function (req, res, next) {
  if (
    req.app.websocketHandler === undefined ||
    req.headers.get('connection') !== 'Upgrade' ||
    req.headers.get('upgrade') !== 'websocket'
  )
    return next()

  const upgradeOptions = (await req.app.websocketHandler.getUpgradeOptions?.(req)) || {}
  req.app.server.upgrade(req, upgradeOptions)
}

class Application {
  server: Bun.Server | null = null
  readonly router: Router
  websocketHandler?: WebSocketHandler
  constructor() {
    this.router = Router()
  }

  /**
   * Provide a WebSocketHandler to enable WebSocket support.
   *
   * Must call before calling `listen(port)`.
   *
   * Should call after some middlewares such as session middleware, cors middleware ...
   * then the `req` object passed to `getUpgradeOptions` method will have the data from the middlewares.
   */
  websocket<T = unknown>(handler: WebSocketHandler<T>) {
    if (this.websocketHandler !== undefined) throw new Error('WebSocket handler already exists')
    this.websocketHandler = handler
    this.router.get(handler.path || '/ws', websocketUpgradeRequestHandler)
    return this
  }

  listen(port: number): Bun.Server
  listen(port: number, hostname: string): Bun.Server
  listen(port: number, hostname: string, tlsOptions: Bun.TLSOptions): Bun.Server
  listen(port: number, tlsOptions: Bun.TLSOptions): Bun.Server
  listen(port: number, hostname = undefined, tlsOptions = undefined) {
    if (typeof hostname === 'object') {
      tlsOptions = hostname
      hostname = undefined
    }
    const app = this
    if (app.server) return app.server
    app.server = Bun.serve({
      port,
      hostname,
      tls: tlsOptions,
      fetch(req) {
        return handleRequest(app, req)
      },
      websocket: app.websocketHandler,
      error(error) {
        console.error(error)
        return new Response(app, null)
          .setStatusCode(500)
          .setTextBody('Internal Server Error')
          .toNativeResponse()
      },
    })
    return app.server
  }
}

function handleRequest(app: Application, req: Request) {
  const url = new URL(req.url)
  Object.assign(req, {
    app,
    ip: app.server.requestIP(req),
    originalPath: url.pathname,
    path: url.pathname,
    params: {},
    query: qs.parse(url.search.slice(1)),
  })
  const res = new Response(app, req)
  Object.assign(req, { res })
  return new Promise<globalThis.Response>(resolve => {
    res.addCloseListener(() => {
      resolve(res.toNativeResponse())
    })
    app.router(req, res, async function (err) {
      if (err) {
        res.setStatusCode(500).setTextBody('Internal Server Error').close()
      } else {
        res.setStatusCode(404).setTextBody('Not Found').close()
      }
    })
  })
}

export default Application

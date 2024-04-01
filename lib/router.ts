import type { SocketAddress } from 'bun'
import type { ParsedUrlQuery } from 'node:querystring'
import type Application from './application'
import type { Response } from './response'
import { httpMethods, isErrorRequestHandler, parseParams } from './utils'

declare global {
  interface Request {
    /**
     * Application instance.
     */
    readonly app: Application
    /**
     * IP address of the client.
     */
    readonly ip: SocketAddress
    /**
     * Original path from the request.
     */
    readonly originalPath: string
    /**
     * Path after matched by the router.
     */
    readonly path: string
    /**
     * Parameters from the path.
     */
    readonly params: Record<string, string>
    /**
     * Query parameters parsed by `node:querystring`.
     */
    readonly query: ParsedUrlQuery
    /**
     * The response object for the request.
     */
    readonly res: Response
    /**
     * Error object if any error occurred in the request handlers.
     */
    readonly error?: any
  }
}

export interface NextFunction {
  (err?: any): void
}

export interface RequestHandler {
  (req: Request, res: Response, next: NextFunction): any
}

export type ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => any

export interface RouterStackLayer {
  method?: (typeof httpMethods)[number]
  pathRegex: RegExp
  paramNames?: string[]
  handler: RequestHandler | ErrorRequestHandler
}

export interface Router extends RequestHandler {
  stack: RouterStackLayer[]

  use(...handlers: RequestHandler[]): Router
  use(prefix: string, ...handlers: RequestHandler[]): Router
  use(regexp: RegExp, ...handlers: RequestHandler[]): Router
  use(...handlers: ErrorRequestHandler[]): Router
  use(prefix: string, ...handlers: ErrorRequestHandler[]): Router
  use(regexp: RegExp, ...handlers: ErrorRequestHandler[]): Router

  get(path: string | RegExp, ...handlers: RequestHandler[]): Router
  post(path: string | RegExp, ...handlers: RequestHandler[]): Router
  put(path: string | RegExp, ...handlers: RequestHandler[]): Router
  patch(path: string | RegExp, ...handlers: RequestHandler[]): Router
  delete(path: string | RegExp, ...handlers: RequestHandler[]): Router
  options(path: string | RegExp, ...handlers: RequestHandler[]): Router
  head(path: string | RegExp, ...handlers: RequestHandler[]): Router
  connect(path: string | RegExp, ...handlers: RequestHandler[]): Router
  trace(path: string | RegExp, ...handlers: RequestHandler[]): Router
  all(path: string | RegExp, ...handlers: RequestHandler[]): Router

  get(path: string | RegExp, ...handlers: ErrorRequestHandler[]): Router
  post(path: string | RegExp, ...handlers: ErrorRequestHandler[]): Router
  put(path: string | RegExp, ...handlers: ErrorRequestHandler[]): Router
  patch(path: string | RegExp, ...handlers: ErrorRequestHandler[]): Router
  delete(path: string | RegExp, ...handlers: ErrorRequestHandler[]): Router
  options(path: string | RegExp, ...handlers: ErrorRequestHandler[]): Router
  head(path: string | RegExp, ...handlers: ErrorRequestHandler[]): Router
  connect(path: string | RegExp, ...handlers: ErrorRequestHandler[]): Router
  trace(path: string | RegExp, ...handlers: ErrorRequestHandler[]): Router
  all(path: string | RegExp, ...handlers: ErrorRequestHandler[]): Router
}

const routerPrototype = {
  use(path, ...handlers) {
    const router: Router = this
    let paramNames = []
    let pathRegex: RegExp
    if (typeof path === 'function') {
      handlers.unshift(path)
      pathRegex = /^\/.*/
    } else if (typeof path === 'string') {
      ;({ paramNames, pathRegex } = parseParams(path))
    }
    handlers.forEach(handler => {
      router.stack.push({
        pathRegex,
        paramNames,
        handler,
      })
    })
    return this
  },
  all(path, ...handlers) {
    const router: Router = this
    let paramNames = []
    let pathRegex: RegExp
    if (typeof path === 'string') {
      ;({ paramNames, pathRegex } = parseParams(path, true))
    } else {
      pathRegex = path
    }
    handlers.forEach(handler => {
      router.stack.push({
        pathRegex,
        paramNames,
        handler,
      })
    })
    return this
  },
  ...Object.fromEntries(
    httpMethods.map(method => [
      method,
      function (path: string | RegExp, ...handlers: (RequestHandler | ErrorRequestHandler)[]) {
        const router: Router = this
        let paramNames = []
        let pathRegex: RegExp
        if (typeof path === 'string') {
          ;({ paramNames, pathRegex } = parseParams(path, true))
        } else {
          pathRegex = path
        }
        handlers.forEach(handler => {
          router.stack.push({
            method,
            pathRegex,
            paramNames,
            handler,
          })
        })
        return this
      },
    ])
  ),
  __proto__: Function.prototype,
}

export function Router() {
  // @ts-ignore
  const router: Router = function (req, res, next) {
    return handleRequest(router, req, res, next)
  }
  router.stack = []
  // @ts-ignore
  router.__proto__ = routerPrototype
  return router
}

const kRoutePath = Symbol.for('routePath')

async function handleRequest(router: Router, req: Request, res: Response, next: NextFunction) {
  const { stack } = router
  if (stack.length === 0) return next()

  const { params: prevParams, path: prevPath } = req
  const routePath: string = req[kRoutePath] || req.originalPath

  for (const layer of stack) {
    if (layer.method && layer.method !== req.method.toLowerCase()) continue
    const match = layer.pathRegex.exec(routePath)
    if (!match) continue

    let nextRoutePath = routePath.slice(match[0].length)
    if (!nextRoutePath.startsWith('/')) nextRoutePath = '/' + nextRoutePath
    Object.assign(req, {
      path: routePath,
      [kRoutePath]: nextRoutePath,
      params: {
        ...prevParams,
        ...Object.fromEntries(layer.paramNames.map((name, i) => [name, match[i + 1]])),
      },
    })

    const handler = layer.handler
    const isHandlerError = isErrorRequestHandler(handler)

    await new Promise<void>(async resolve => {
      res.addCloseListener(resolve)
      const next: NextFunction = err => {
        // Assign error to req to pass it to the next error request handler
        // Clear error if no error
        // This is to prevent passing the error to the next request handler
        Object.assign(req, {
          error: err || null,
        })
        res.removeCloseListener(resolve)
        resolve()
      }

      if (req.error) {
        if (isHandlerError) {
          try {
            await handler(req.error, req, res, next)
          } catch (error) {
            next(error)
          }
        } else {
          next(req.error)
        }
      } else {
        if (!isHandlerError) {
          try {
            await handler(req, res, next)
          } catch (error) {
            next(error)
          }
        } else {
          next()
        }
      }
    })

    Object.assign(req, {
      path: prevPath,
      [kRoutePath]: routePath,
      params: prevParams,
    })

    if (res.closed) break
  }

  if (res.closed) return
  req.error ? next(req.error) : next()
}

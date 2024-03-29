import Application from './lib/application'
import { Router, RequestHandler, ErrorRequestHandler } from './lib/router'

declare function express<WSData = unknown>(): Application<WSData>
declare namespace express {
  declare function Router(): Router
}

export default express
export { Router, RequestHandler, ErrorRequestHandler }

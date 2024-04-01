import Application from './lib/application'
import type { Router, RequestHandler, ErrorRequestHandler } from './lib/router'

declare function express(): Application
declare namespace express {
  declare function Router(): Router
}

export default express
export { Router, RequestHandler, ErrorRequestHandler }

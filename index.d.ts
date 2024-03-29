import Application from './lib/application'
import { Router } from './lib/router'

declare function express<WSData = unknown>(): Application<WSData>
declare namespace express {
  declare function Router(): Router
}

export default express
export { Router }

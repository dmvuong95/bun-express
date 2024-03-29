import Application from './lib/application'
import { Router } from './lib/router'

function express() {
  return new Application()
}
express.Router = Router

export default express
export { Router }

import express from '../index'
import type { ErrorRequestHandler } from '../lib/router'

const app = express()

app.router.use((req, res, next) => {
  console.log('Middleware')
  setTimeout(next, 10)
})

app.router.post(
  '/hello',
  async (req, res, next) => {
    console.log('Hello')

    // return next(new Error('Error test by next'))
    // throw new Error('Error test by throw')

    // res.body = 'Hello'
    // const writer = res.getWriter()
    // await writer.ready
    // await writer.write('Hiiiiiii')
    // await writer.close()

    // res.setHeader('Content-Type', 'application/json; charset=utf-8')
    // await writer.write(JSON.stringify({ message: 'Hello' }))
    // await writer.close()

    // res.setJsonBody({ message: 'Hello' }).close()

    next()
  },
  async (req, res) => {
    console.log('World')
    const file = Bun.file('./package.json')

    res.setBlobBody(file).close()

    // res.setHeader('Content-Type', file.type)
    // const stream = file.stream()
    // stream.pipeTo(res)

    // const writer = res.getWriter()
    // await writer.ready
    // await writer.write(JSON.stringify({ message: 'Hello' }))
    // await writer.close()
  }
)

const router = express.Router()
router.post('/bars', (req, res, next) => {
  console.log('Bars:', req.path, req.params, req.query)
  res.body = 'Bars'
  res.close()
})
router.post(
  '/bars/:bar',
  (req, res, next) => {
    console.log('Original Path:', req.originalPath)
    console.log('Bar:', req.path, req.params, req.query)
    next()
  },
  (req, res, next) => {
    res.body = 'Bar: ' + req.params.bar
    res.close()
  }
)
app.router.use('/foo', router)

app.router.use(((err, req, res, next) => {
  console.log('Error handler:', err)
  next(err)
}) as ErrorRequestHandler)

app.listen(3000)
console.log('Server is running on port 3000')

import type { BodyInit } from 'undici-types/fetch'
import type Application from './application'

export class Response extends WritableStream<string | Buffer> {
  app: Application
  statusCode = 200
  headers = new Headers()
  body?: BodyInit
  readonly req: Request
  #closeListeners: Set<Bun.UnderlyingSinkCloseCallback> = new Set()
  #closed = false

  constructor(app: Application, req: Request) {
    const chunks: Buffer[] = []
    const onClose = () => {
      if (this.#closed) return
      this.#closed = true
      for (const listener of this.#closeListeners) {
        try {
          listener()
        } catch (error) {
          console.error(error)
        }
      }
    }
    super({
      abort: reason => {
        this.statusCode = 500
        this.body = 'Internal Server Error'
        onClose()
      },
      close: () => {
        if (chunks.length > 0 && (this.body === undefined || this.body === null)) {
          this.body = Buffer.concat(chunks)
        }
        return onClose()
      },
      write: chunk => {
        chunks.push(Buffer.from(chunk))
      },
    })
    this.app = app
    this.req = req
  }

  get closed() {
    return this.#closed
  }

  addCloseListener(callback: Bun.UnderlyingSinkCloseCallback) {
    if (this.closed) {
      callback()
      return
    }
    this.#closeListeners.add(callback)
  }
  removeCloseListener(callback: Bun.UnderlyingSinkCloseCallback) {
    return this.#closeListeners.delete(callback)
  }

  setStatusCode(statusCode: number) {
    this.statusCode = statusCode
    return this
  }
  setHeader(name: string, value: string) {
    this.headers.set(name, value)
    return this
  }

  setJsonBody(data: any) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8')
    this.body = JSON.stringify(data)
    return this
  }

  setHtmlBody(data: string) {
    this.setHeader('Content-Type', 'text/html; charset=utf-8')
    this.body = data
    return this
  }

  setTextBody(data: string) {
    this.setHeader('Content-Type', 'text/plain; charset=utf-8')
    this.body = data
    return this
  }

  setBlobBody(data: Blob) {
    this.body = data
    if (data.type) {
      this.setHeader('Content-Type', data.type)
    }
    return this
  }

  toNativeResponse() {
    return new globalThis.Response(this.body, {
      status: this.statusCode,
      headers: this.headers,
    })
  }
}

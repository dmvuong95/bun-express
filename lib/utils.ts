import type { ErrorRequestHandler, RequestHandler } from './router'

export const httpMethods = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
  'connect',
  'trace',
] as const

export const isErrorRequestHandler = (
  handler: RequestHandler | ErrorRequestHandler
): handler is ErrorRequestHandler => {
  return handler.length >= 4
}

export const parseParams = (path: string, matchFull?: boolean) => {
  const paramNames: string[] = []
  if (!path.startsWith('/')) path = `/${path}`
  const paramRegex = /\/:([^/]+)/g
  let match: RegExpExecArray | null
  while ((match = paramRegex.exec(path))) {
    paramNames.push(match[1])
  }
  const pathRegex = new RegExp(
    `^${path.replace(paramRegex, '/([^/]+)')}` + (matchFull ? '$' : ''),
    'i'
  )
  return { paramNames, pathRegex }
}

// Thin client for the existing Opstack JSON API. The Node service keeps every
// permission, scope and CSRF check; this layer only carries the session token
// header and the selected location.

let csrf = ''
let locationId = ''
const listeners = new Set()

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export function setCsrf(token) {
  csrf = token || ''
}

export function setActiveLocation(id) {
  locationId = id || ''
}

export function onRequiredReading(handler) {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

export async function api(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const requestHeaders = { Accept: 'application/json', ...headers }
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'
  // Several read endpoints (accounts, permission levels) also verify the
  // session token header, so send it whenever the session has one.
  if (csrf) requestHeaders['x-csrf-token'] = csrf
  if (locationId) requestHeaders['X-Location-Id'] = locationId

  const response = await fetch(path, {
    method,
    headers: requestHeaders,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  let payload = null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null)
  } else if (response.status !== 204) {
    payload = await response.text().catch(() => null)
  }

  if (response.status === 428 && payload?.code === 'REQUIRED_POSTS') {
    for (const listener of listeners) listener(payload.required)
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && payload.error) ||
      `Request failed (${response.status}).`
    throw new ApiError(message, response.status, payload)
  }

  return payload
}

export function get(path, options) {
  return api(path, { ...options, method: 'GET' })
}

export function post(path, body, options) {
  return api(path, { ...options, method: 'POST', body })
}

export function put(path, body, options) {
  return api(path, { ...options, method: 'PUT', body })
}

export function del(path, body, options) {
  return api(path, { ...options, method: 'DELETE', body })
}

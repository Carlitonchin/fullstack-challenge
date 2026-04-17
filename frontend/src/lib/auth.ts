import {
  useSyncExternalStore,
} from "react"

type JwtClaims = {
  sub?: string
  preferred_username?: string
  exp?: number
}

export type AuthUser = {
  id: string
  username: string
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: number
  refreshTokenExpiresAt: number
  user: AuthUser
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  refresh_expires_in?: number
}

type TokenErrorResponse = {
  error?: string
  error_description?: string
}

const SESSION_STORAGE_KEY = "crash-game.auth.session"
const AUTH_STATE_STORAGE_KEY = "crash-game.auth.state"
const AUTH_VERIFIER_STORAGE_KEY = "crash-game.auth.verifier"
const AUTH_REDIRECT_STORAGE_KEY = "crash-game.auth.redirect"
const CLOCK_SKEW_MS = 30_000

const listeners = new Set<() => void>()
let cachedSession = readStoredSession()
let refreshPromise: Promise<AuthSession> | null = null
let authFailureHandler: (() => void) | null = null
let callbackExchangePromise: Promise<string> | null = null
let callbackExchangeKey: string | null = null

class AuthTokenRequestError extends Error {
  oauthError?: string

  constructor(message: string, oauthError?: string) {
    super(message)
    this.name = "AuthTokenRequestError"
    this.oauthError = oauthError
  }
}

function getAuthConfig() {
  const baseUrl = import.meta.env.VITE_KEYCLOAK_BASE_URL ?? "http://localhost:8080"
  const realm = import.meta.env.VITE_KEYCLOAK_REALM ?? "crash-game"
  const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? "crash-game-client"
  const redirectUri =
    import.meta.env.VITE_KEYCLOAK_REDIRECT_URI ?? `${window.location.origin}/auth/callback`

  const realmBaseUrl = `${baseUrl}/realms/${realm}`

  return {
    clientId,
    redirectUri,
    authorizationEndpoint: `${realmBaseUrl}/protocol/openid-connect/auth`,
    tokenEndpoint: `${realmBaseUrl}/protocol/openid-connect/token`,
  }
}

function emitSessionChange() {
  listeners.forEach((listener) => listener())
}

function decodeJwtClaims(token: string): JwtClaims {
  const [, payload] = token.split(".")

  if (!payload) {
    throw new Error("Invalid JWT payload")
  }

  const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/")
  const paddedPayload = normalizedPayload.padEnd(
    normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
    "=",
  )

  return JSON.parse(window.atob(paddedPayload)) as JwtClaims
}

function buildUserFromAccessToken(accessToken: string): AuthUser {
  const claims = decodeJwtClaims(accessToken)

  if (!claims.sub) {
    throw new Error("Access token is missing subject claim")
  }

  return {
    id: claims.sub,
    username: claims.preferred_username?.trim() || claims.sub,
  }
}

function createSessionFromTokenResponse(
  response: TokenResponse,
  previousSession?: AuthSession,
): AuthSession {
  const now = Date.now()
  const accessToken = response.access_token
  const refreshToken = response.refresh_token ?? previousSession?.refreshToken

  if (!refreshToken) {
    throw new Error("Refresh token is missing")
  }

  const claims = decodeJwtClaims(accessToken)
  const accessTokenExpiresAt =
    typeof claims.exp === "number"
      ? claims.exp * 1000
      : now + response.expires_in * 1000

  const refreshTokenExpiresAt =
    typeof response.refresh_expires_in === "number"
      ? now + response.refresh_expires_in * 1000
      : previousSession?.refreshTokenExpiresAt ?? now

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
    user: buildUserFromAccessToken(accessToken),
  }
}

function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

function persistSession(session: AuthSession | null) {
  console.log("[auth] persistSession", {
    hasSession: Boolean(session),
    user: session?.user,
    accessTokenExpiresAt: session?.accessTokenExpiresAt,
    refreshTokenExpiresAt: session?.refreshTokenExpiresAt,
  })
  cachedSession = session

  if (typeof window !== "undefined") {
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    }
  }

  emitSessionChange()
}

function clearLoginAttemptState() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(AUTH_STATE_STORAGE_KEY)
  window.localStorage.removeItem(AUTH_VERIFIER_STORAGE_KEY)
}

function clearAllLocalAuthState() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.clear()
  cachedSession = null
  emitSessionChange()
}

function getStoredRedirectPath(): string {
  if (typeof window === "undefined") {
    return "/"
  }

  return window.localStorage.getItem(AUTH_REDIRECT_STORAGE_KEY) ?? "/"
}

function storeRedirectPath(redirectPath: string) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, redirectPath)
}

function consumeRedirectPath(): string {
  const redirectPath = getStoredRedirectPath()

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY)
  }

  return redirectPath
}

function isExpired(expiresAt: number): boolean {
  return Date.now() + CLOCK_SKEW_MS >= expiresAt
}

async function sha256Base64Url(value: string): Promise<string> {
  const encodedValue = new TextEncoder().encode(value)
  const digest = await window.crypto.subtle.digest("SHA-256", encodedValue)
  const bytes = Array.from(new Uint8Array(digest))
  const binary = bytes.map((byte) => String.fromCharCode(byte)).join("")

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function createRandomString(length: number): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  const randomValues = new Uint8Array(length)

  window.crypto.getRandomValues(randomValues)

  return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join("")
}

async function requestToken(
  params: URLSearchParams,
  previousSession?: AuthSession,
): Promise<AuthSession> {
  const config = getAuthConfig()
  console.log("[auth] requestToken:start", {
    grantType: params.get("grant_type"),
    redirectUri: params.get("redirect_uri"),
    hasCode: Boolean(params.get("code")),
    hasRefreshToken: Boolean(params.get("refresh_token")),
  })
  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  if (!response.ok) {
    let errorPayload: TokenErrorResponse | null = null

    try {
      errorPayload = (await response.json()) as TokenErrorResponse
    } catch {
      errorPayload = null
    }

    console.log("[auth] requestToken:error", {
      status: response.status,
      error: errorPayload?.error,
      description: errorPayload?.error_description,
    })
    if (errorPayload?.error === "invalid_grant") {
      clearAllLocalAuthState()
    }

    throw new AuthTokenRequestError(
      errorPayload?.error_description ??
        errorPayload?.error ??
        "Keycloak token request failed",
      errorPayload?.error,
    )
  }

  const payload = (await response.json()) as TokenResponse
  console.log("[auth] requestToken:success", {
    hasAccessToken: Boolean(payload.access_token),
    hasRefreshToken: Boolean(payload.refresh_token ?? previousSession?.refreshToken),
    expiresIn: payload.expires_in,
    refreshExpiresIn: payload.refresh_expires_in,
  })
  return createSessionFromTokenResponse(payload, previousSession)
}

function notifyAuthFailure() {
  authFailureHandler?.()
}

export function registerAuthFailureHandler(handler: (() => void) | null) {
  authFailureHandler = handler
}

export function subscribeToAuthSession(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function getAuthSession(): AuthSession | null {
  return cachedSession
}

export function useAuthSession() {
  return useSyncExternalStore(subscribeToAuthSession, getAuthSession, () => null)
}

export function clearAuthSession() {
  clearLoginAttemptState()
  persistSession(null)
}

export function getAuthenticatedPlayer(): AuthUser | null {
  return cachedSession?.user ?? null
}

export async function beginLogin(redirectPath = window.location.pathname + window.location.search + window.location.hash) {
  const config = getAuthConfig()
  const verifier = createRandomString(96)
  const state = createRandomString(48)
  const challenge = await sha256Base64Url(verifier)
  const authorizationUrl = new URL(config.authorizationEndpoint)

  storeRedirectPath(redirectPath)
  window.localStorage.setItem(AUTH_STATE_STORAGE_KEY, state)
  window.localStorage.setItem(AUTH_VERIFIER_STORAGE_KEY, verifier)

  authorizationUrl.searchParams.set("client_id", config.clientId)
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri)
  authorizationUrl.searchParams.set("response_type", "code")
  authorizationUrl.searchParams.set("scope", "openid profile email")
  authorizationUrl.searchParams.set("state", state)
  authorizationUrl.searchParams.set("code_challenge", challenge)
  authorizationUrl.searchParams.set("code_challenge_method", "S256")

  window.location.assign(authorizationUrl.toString())
}

export async function handleAuthCallback(callbackUrl = window.location.href): Promise<string> {
  console.log("[auth] handleAuthCallback:start", { callbackUrl })
  if (callbackExchangePromise && callbackExchangeKey === callbackUrl) {
    console.log("[auth] handleAuthCallback:reuse-existing-promise")
    return callbackExchangePromise
  }

  const url = new URL(callbackUrl)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const authError = url.searchParams.get("error")
  const storedState = window.localStorage.getItem(AUTH_STATE_STORAGE_KEY)
  const verifier = window.localStorage.getItem(AUTH_VERIFIER_STORAGE_KEY)
  const config = getAuthConfig()

  console.log("[auth] handleAuthCallback:parsed", {
    hasCode: Boolean(code),
    state,
    storedState,
    hasVerifier: Boolean(verifier),
    authError,
  })

  if (authError) {
    clearLoginAttemptState()
    throw new Error(authError)
  }

  if (!code || !state || state !== storedState || !verifier) {
    clearLoginAttemptState()
    throw new Error("Invalid Keycloak callback state")
  }

  callbackExchangeKey = callbackUrl
  callbackExchangePromise = requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
    }),
  )
    .then((session) => {
      console.log("[auth] handleAuthCallback:token-exchanged", {
        user: session.user,
      })
      clearLoginAttemptState()
      persistSession(session)
      const redirectPath = consumeRedirectPath()
      console.log("[auth] handleAuthCallback:redirect-ready", { redirectPath })
      return redirectPath
    })
    .catch((error: unknown) => {
      console.log("[auth] handleAuthCallback:error", {
        error,
      })
      throw error
    })
    .finally(() => {
      console.log("[auth] handleAuthCallback:finally")
      callbackExchangePromise = null
      callbackExchangeKey = null
    })

  return callbackExchangePromise
}

export async function refreshAuthSession(): Promise<AuthSession> {
  if (refreshPromise) {
    return refreshPromise
  }

  const session = cachedSession

  if (!session || isExpired(session.refreshTokenExpiresAt)) {
    clearAuthSession()
    throw new Error("Refresh token is expired")
  }

  const config = getAuthConfig()

  refreshPromise = requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      refresh_token: session.refreshToken,
    }),
    session,
  )
    .then((nextSession) => {
      persistSession(nextSession)
      return nextSession
    })
    .catch((error: unknown) => {
      clearAuthSession()
      throw error instanceof Error ? error : new Error("Failed to refresh session")
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

export async function ensureValidAccessToken(): Promise<string> {
  const session = cachedSession

  console.log("[auth] ensureValidAccessToken:start", {
    hasSession: Boolean(session),
    accessTokenExpiresAt: session?.accessTokenExpiresAt,
    refreshTokenExpiresAt: session?.refreshTokenExpiresAt,
  })

  if (!session) {
    throw new Error("Missing auth session")
  }

  if (!isExpired(session.accessTokenExpiresAt)) {
    console.log("[auth] ensureValidAccessToken:using-current-token")
    return session.accessToken
  }

  console.log("[auth] ensureValidAccessToken:refresh-needed")
  const refreshedSession = await refreshAuthSession()
  console.log("[auth] ensureValidAccessToken:refresh-complete")
  return refreshedSession.accessToken
}

export function redirectToLogin(redirectPath = window.location.pathname + window.location.search + window.location.hash) {
  storeRedirectPath(redirectPath)
  notifyAuthFailure()
  window.location.replace("/login")
}

export function logoutToLogin() {
  clearAuthSession()
  notifyAuthFailure()
  window.location.replace("/login")
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_STORAGE_KEY) {
      cachedSession = readStoredSession()
      emitSessionChange()
    }
  })
}

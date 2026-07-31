import { useAuthStore } from "@/stores/authStore"

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type ChatResponse = {
  session_id: string
  reply: string
}

export type SessionSummary = {
  session_id: string
  title: string
  preview: string
  updated_at: string | null
}

export type SessionHistoryResponse = {
  session_id: string
  messages: ChatMessage[]
}

export type StreamChatHandlers = {
  onSession?: (sessionId: string) => void
  onToken?: (content: string) => void
  onDone?: (sessionId: string) => void
  onError?: (detail: string) => void
  signal?: AbortSignal
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
  /\/$/,
  "",
)

if (!API_BASE_URL) {
  console.warn("VITE_API_BASE_URL is not set; chat requests will fail.")
}

export function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is not configured")
  }
  return API_BASE_URL
}

async function authHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const token = await useAuthStore.getState().getIdToken()
  const headers: Record<string, string> = {
    ...(extra as Record<string, string> | undefined),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

async function parseError(response: Response): Promise<string> {
  const detail = await response.text()
  return detail || `Request failed (${response.status})`
}

export async function postChat(message: string, sessionId: string | null): Promise<ChatResponse> {
  const response = await fetch(`${getApiBaseUrl()}/chat`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      message,
      session_id: sessionId,
    }),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json() as Promise<ChatResponse>
}

export async function streamChat(
  message: string,
  sessionId: string | null,
  handlers: StreamChatHandlers,
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/chat/stream`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json", Accept: "text/event-stream" }),
    body: JSON.stringify({
      message,
      session_id: sessionId,
    }),
    signal: handlers.signal,
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  if (!response.body) {
    throw new Error("Streaming response had no body")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""

    for (const part of parts) {
      const dataLine = part
        .split("\n")
        .map((line) => line.trimEnd())
        .find((line) => line.startsWith("data:"))
      if (!dataLine) continue
      const raw = dataLine.slice(5).trim()
      if (!raw || raw === "[DONE]") continue
      let event: { type?: string; session_id?: string; content?: string; detail?: string }
      try {
        event = JSON.parse(raw) as typeof event
      } catch {
        continue
      }
      if (event.type === "session" && event.session_id) {
        handlers.onSession?.(event.session_id)
      } else if (event.type === "token" && event.content) {
        handlers.onToken?.(event.content)
      } else if (event.type === "done" && event.session_id) {
        handlers.onDone?.(event.session_id)
      } else if (event.type === "error") {
        const detail = event.detail || "Stream failed"
        handlers.onError?.(detail)
        throw new Error(detail)
      }
    }
  }
}

export async function listSessions(): Promise<SessionSummary[]> {
  const response = await fetch(`${getApiBaseUrl()}/sessions`, {
    headers: await authHeaders(),
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  const body = (await response.json()) as { sessions: SessionSummary[] }
  return body.sessions
}

export async function getSession(sessionId: string): Promise<SessionHistoryResponse> {
  const response = await fetch(`${getApiBaseUrl()}/sessions/${encodeURIComponent(sessionId)}`, {
    headers: await authHeaders(),
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  return response.json() as Promise<SessionHistoryResponse>
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(await parseError(response))
  }
}

export type HealthResponse = {
  status: string
  app: string
  environment: string
  model?: string
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${getApiBaseUrl()}/health`)
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`)
  }
  return response.json() as Promise<HealthResponse>
}

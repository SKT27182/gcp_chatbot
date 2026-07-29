export type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type ChatResponse = {
  session_id: string
  reply: string
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

export async function postChat(message: string, sessionId: string | null): Promise<ChatResponse> {
  const response = await fetch(`${getApiBaseUrl()}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Chat request failed (${response.status})`)
  }

  return response.json() as Promise<ChatResponse>
}

export async function getHealth(): Promise<{ status: string }> {
  const response = await fetch(`${getApiBaseUrl()}/health`)
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`)
  }
  return response.json() as Promise<{ status: string }>
}

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ChatMessage, SessionSummary } from "@/lib/api"

type ChatState = {
  sessionId: string | null
  messages: ChatMessage[]
  draft: string
  sessions: SessionSummary[]
  sidebarOpen: boolean
  selectedModel: string | null
  setDraft: (value: string) => void
  setSessionId: (sessionId: string | null) => void
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  appendToLastAssistant: (chunk: string) => void
  replaceLastAssistant: (patch: Partial<ChatMessage> & { content: string }) => void
  removeLastEmptyAssistant: () => void
  setSessions: (sessions: SessionSummary[]) => void
  upsertSession: (session: SessionSummary) => void
  removeSession: (sessionId: string) => void
  patchSession: (sessionId: string, patch: Partial<SessionSummary>) => void
  setSidebarOpen: (open: boolean) => void
  setSelectedModel: (model: string) => void
  resetConversation: () => void
  loadConversation: (sessionId: string, messages: ChatMessage[]) => void
}

function titleFromMessage(message: string): string {
  const cleaned = message.trim().replace(/\s+/g, " ")
  if (cleaned.length <= 48) return cleaned || "New chat"
  return `${cleaned.slice(0, 47)}…`
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessionId: null,
      messages: [],
      draft: "",
      sessions: [],
      sidebarOpen: true,
      selectedModel: null,
      setDraft: (draft) => set({ draft }),
      setSessionId: (sessionId) => set({ sessionId }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),
      appendToLastAssistant: (chunk) =>
        set((state) => {
          const messages = [...state.messages]
          const last = messages[messages.length - 1]
          if (!last || last.role !== "assistant") {
            messages.push({ role: "assistant", content: chunk, status: "streaming" })
          } else {
            messages[messages.length - 1] = {
              ...last,
              content: last.content + chunk,
              status: "streaming",
            }
          }
          return { messages }
        }),
      replaceLastAssistant: (patch) =>
        set((state) => {
          const messages = [...state.messages]
          const last = messages[messages.length - 1]
          if (!last || last.role !== "assistant") return state
          messages[messages.length - 1] = { ...last, ...patch }
          return { messages }
        }),
      removeLastEmptyAssistant: () =>
        set((state) => {
          const last = state.messages[state.messages.length - 1]
          if (!last || last.role !== "assistant" || last.content) return state
          return { messages: state.messages.slice(0, -1) }
        }),
      setSessions: (sessions) => set({ sessions }),
      upsertSession: (session) =>
        set((state) => {
          const existing = state.sessions.find((s) => s.session_id === session.session_id)
          // Keep an existing sidebar title on follow-up upserts (local optimistic
          // titles use the latest user message). Server refreshes use setSessions.
          const merged: SessionSummary = {
            ...session,
            title: existing?.title || session.title,
          }
          const rest = state.sessions.filter((s) => s.session_id !== session.session_id)
          return {
            sessions: [merged, ...rest].sort((a, b) => {
              const at = a.updated_at ? Date.parse(a.updated_at) : 0
              const bt = b.updated_at ? Date.parse(b.updated_at) : 0
              return bt - at
            }),
          }
        }),
      removeSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.session_id !== sessionId),
          ...(state.sessionId === sessionId
            ? { sessionId: null, messages: [], draft: "" }
            : {}),
        })),
      patchSession: (sessionId, patch) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.session_id === sessionId ? { ...s, ...patch } : s,
          ),
        })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setSelectedModel: (selectedModel) => set({ selectedModel }),
      resetConversation: () =>
        set({
          sessionId: null,
          messages: [],
          draft: "",
        }),
      loadConversation: (sessionId, messages) =>
        set({
          sessionId,
          messages,
          draft: "",
        }),
    }),
    {
      name: "gcp-chatbot-session",
      partialize: (state) => ({
        sessionId: state.sessionId,
        messages: state.messages,
        sessions: state.sessions,
        sidebarOpen: state.sidebarOpen,
        selectedModel: state.selectedModel,
      }),
    },
  ),
)

export function buildLocalSessionSummary(
  sessionId: string,
  userMessage: string,
  assistantReply: string,
): SessionSummary {
  return {
    session_id: sessionId,
    title: titleFromMessage(userMessage),
    preview: titleFromMessage(assistantReply),
    updated_at: new Date().toISOString(),
  }
}

export { titleFromMessage }

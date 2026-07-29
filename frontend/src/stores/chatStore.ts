import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ChatMessage, SessionSummary } from "@/lib/api"

type ChatState = {
  sessionId: string | null
  messages: ChatMessage[]
  draft: string
  sessions: SessionSummary[]
  sidebarOpen: boolean
  setDraft: (value: string) => void
  setSessionId: (sessionId: string | null) => void
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  setSessions: (sessions: SessionSummary[]) => void
  upsertSession: (session: SessionSummary) => void
  setSidebarOpen: (open: boolean) => void
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
      setDraft: (draft) => set({ draft }),
      setSessionId: (sessionId) => set({ sessionId }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),
      setSessions: (sessions) => set({ sessions }),
      upsertSession: (session) =>
        set((state) => {
          const rest = state.sessions.filter((s) => s.session_id !== session.session_id)
          return {
            sessions: [session, ...rest].sort((a, b) => {
              const at = a.updated_at ? Date.parse(a.updated_at) : 0
              const bt = b.updated_at ? Date.parse(b.updated_at) : 0
              return bt - at
            }),
          }
        }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
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

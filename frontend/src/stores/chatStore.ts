import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ChatMessage } from "@/lib/api"

type ChatState = {
  sessionId: string | null
  messages: ChatMessage[]
  draft: string
  setDraft: (value: string) => void
  setSessionId: (sessionId: string) => void
  addMessage: (message: ChatMessage) => void
  resetConversation: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessionId: null,
      messages: [],
      draft: "",
      setDraft: (draft) => set({ draft }),
      setSessionId: (sessionId) => set({ sessionId }),
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),
      resetConversation: () =>
        set({
          sessionId: null,
          messages: [],
          draft: "",
        }),
    }),
    {
      name: "gcp-chatbot-session",
      partialize: (state) => ({
        sessionId: state.sessionId,
        messages: state.messages,
      }),
    },
  ),
)

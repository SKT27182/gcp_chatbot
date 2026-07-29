import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowUp, Loader2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { ChatSidebar } from "@/features/chat/ChatSidebar"
import { MessageList } from "@/features/chat/MessageList"
import { deleteSession, getHealth, getSession, listSessions, postChat } from "@/lib/api"
import { buildLocalSessionSummary, titleFromMessage, useChatStore } from "@/stores/chatStore"

export function ChatPage() {
  const queryClient = useQueryClient()
  const {
    sessionId,
    messages,
    draft,
    sessions,
    sidebarOpen,
    setDraft,
    setSessionId,
    addMessage,
    setSessions,
    upsertSession,
    removeSession,
    patchSession,
    setSidebarOpen,
    resetConversation,
    loadConversation,
  } = useChatStore()
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    staleTime: 60_000,
  })

  const activeModelName = useMemo(() => {
    const rawModel = healthQuery.data?.model || "vertex_ai/gemini-3.5-flash-lite"
    return rawModel.replace(/^(vertex_ai\/|gemini\/)/, "")
  }, [healthQuery.data])

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: listSessions,
    staleTime: 15_000,
    retry: 1,
  })

  useEffect(() => {
    if (sessionsQuery.data) {
      setSessions(sessionsQuery.data)
    }
  }, [sessionsQuery.data, setSessions])

  const mutation = useMutation({
    mutationFn: async (message: string) => postChat(message, sessionId),
    onSuccess: (data, message) => {
      addMessage({ role: "user", content: message })
      addMessage({ role: "assistant", content: data.reply })
      setSessionId(data.session_id)
      setDraft("")
      upsertSession(buildLocalSessionSummary(data.session_id, message, data.reply))
      void queryClient.invalidateQueries({ queryKey: ["sessions"] })
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, mutation.isPending])

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault()
    const message = draft.trim()
    if (!message || mutation.isPending) return
    mutation.mutate(message)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  function handlePromptSelect(promptText: string) {
    if (mutation.isPending) return
    setDraft(promptText)
    textareaRef.current?.focus()
  }

  async function handleSelectSession(id: string) {
    if (id === sessionId || loadingSessionId) return
    setLoadError(null)
    setLoadingSessionId(id)
    try {
      const history = await getSession(id)
      const chatMessages = history.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      loadConversation(history.session_id, chatMessages)
      const firstUser = chatMessages.find((m) => m.role === "user")
      if (firstUser) {
        patchSession(history.session_id, { title: titleFromMessage(firstUser.content) })
      }
      mutation.reset()
      if (window.matchMedia("(max-width: 767px)").matches) {
        setSidebarOpen(false)
      }
    } catch (error) {
      setLoadError((error as Error).message || "Failed to load chat")
    } finally {
      setLoadingSessionId(null)
    }
  }

  function handleNewChat() {
    resetConversation()
    mutation.reset()
    setLoadError(null)
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false)
    }
  }

  async function handleDeleteSession(id: string) {
    const title =
      (sessionsQuery.data ?? sessions).find((s) => s.session_id === id)?.title || "this chat"
    if (!window.confirm(`Delete “${title}”? This removes the whole conversation permanently.`)) {
      return
    }
    setLoadError(null)
    setDeletingSessionId(id)
    try {
      await deleteSession(id)
      removeSession(id)
      if (sessionId === id) {
        mutation.reset()
      }
      void queryClient.invalidateQueries({ queryKey: ["sessions"] })
    } catch (error) {
      setLoadError((error as Error).message || "Failed to delete chat")
    } finally {
      setDeletingSessionId(null)
    }
  }

  const displaySessions = sessionsQuery.data ?? sessions

  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <ChatSidebar
        open={sidebarOpen}
        sessions={displaySessions}
        activeSessionId={sessionId}
        loadingSessionId={loadingSessionId}
        deletingSessionId={deletingSessionId}
        onNewChat={handleNewChat}
        onSelectSession={(id) => void handleSelectSession(id)}
        onDeleteSession={(id) => void handleDeleteSession(id)}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col h-full overflow-hidden">


        {/* Chat Messages */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MessageList
            messages={messages}
            isPending={mutation.isPending}
            onSelectPrompt={handlePromptSelect}
          />
          <div ref={bottomRef} />
        </main>

        {/* Floating Input Area */}
        <footer className="w-full shrink-0 pb-4 pt-2 px-3 sm:px-4">
          <div className="mx-auto max-w-3xl">
            {mutation.isError ? (
              <p className="mb-2 text-center text-xs text-destructive">
                {(mutation.error as Error).message || "Failed to send message"}
              </p>
            ) : null}
            {loadError ? (
              <p className="mb-2 text-center text-xs text-destructive">{loadError}</p>
            ) : null}

            <form
              onSubmit={handleSubmit}
              className="relative flex flex-col rounded-2xl border border-border/80 bg-card p-3 shadow-lg transition-all focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40"
            >
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here..."
                rows={1}
                disabled={mutation.isPending || Boolean(loadingSessionId)}
                className="w-full resize-none border-0 bg-transparent px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 min-h-[44px] max-h-[160px]"
              />

              <div className="flex items-center justify-between pt-2 px-1 border-t border-border/30">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {activeModelName}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={mutation.isPending || !draft.trim() || Boolean(loadingSessionId)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-30 disabled:hover:bg-primary"
                  title="Send message"
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </footer>
      </div>
    </div>
  )
}


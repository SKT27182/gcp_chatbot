import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowUp, Loader2, Square } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { ChatSidebar } from "@/features/chat/ChatSidebar"
import { MessageList } from "@/features/chat/MessageList"
import { ModelPicker } from "@/features/chat/ModelPicker"
import { deleteSession, getSession, listModels, listSessions, streamChat } from "@/lib/api"
import { useAuthStore } from "@/stores/authStore"
import { buildLocalSessionSummary, titleFromMessage, useChatStore } from "@/stores/chatStore"

import { LandingPage } from "@/features/auth/LandingPage"
import { EmailVerificationPage } from "@/features/auth/EmailVerificationPage"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Poll until the worker-written LLM title replaces the local fallback (or give up). */
async function waitForGeneratedTitle(
  fallbackTitle: string,
  opts: {
    fetchSessions: () => Promise<void>
    getTitle: () => string | undefined
    signal?: AbortSignal
  },
): Promise<void> {
  // Worker is usually fast; cover cold-start with a short backoff window.
  const delaysMs = [800, 1200, 2000, 3000, 4000, 5000]
  for (const delay of delaysMs) {
    if (opts.signal?.aborted) return
    await sleep(delay)
    if (opts.signal?.aborted) return
    await opts.fetchSessions()
    const title = opts.getTitle()
    if (title && title !== fallbackTitle && title !== "New chat") {
      return
    }
  }
}

export function ChatPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  const {
    sessionId,
    messages,
    draft,
    sessions,
    sidebarOpen,
    selectedModel,
    setDraft,
    setSessionId,
    addMessage,
    appendToLastAssistant,
    replaceLastAssistant,
    removeLastEmptyAssistant,
    setSessions,
    upsertSession,
    removeSession,
    setSidebarOpen,
    setSelectedModel,
    resetConversation,
    loadConversation,
  } = useChatStore()
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const titlePollAbortRef = useRef<AbortController | null>(null)
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: listModels,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const catalog = modelsQuery.data
  useEffect(() => {
    if (!catalog) return
    const ids = new Set(catalog.models.map((m) => m.id))
    if (!selectedModel || !ids.has(selectedModel)) {
      setSelectedModel(catalog.default)
    }
  }, [catalog, selectedModel, setSelectedModel])

  const sessionsQuery = useQuery({
    queryKey: ["sessions", user?.uid ?? "anon"],
    queryFn: listSessions,
    staleTime: 15_000,
    retry: 1,
    enabled: Boolean(user),
  })

  useEffect(() => {
    if (sessionsQuery.data) {
      setSessions(sessionsQuery.data)
    }
  }, [sessionsQuery.data, setSessions])

  useEffect(() => {
    if (!user) {
      resetConversation()
      setSessions([])
    }
  }, [user, resetConversation, setSessions])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  useEffect(() => {
    return () => {
      titlePollAbortRef.current?.abort()
    }
  }, [])

  async function refreshSessions() {
    await queryClient.fetchQuery({
      queryKey: ["sessions", user?.uid ?? "anon"],
      queryFn: listSessions,
    })
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault()
    const message = draft.trim()
    if (!message || isStreaming || !user) return

    const isNewSession = !sessionId
    const fallbackTitle = titleFromMessage(message)
    setLoadError(null)
    setDraft("")
    addMessage({ role: "user", content: message })
    addMessage({ role: "assistant", content: "", status: "streaming" })
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller
    let activeSessionId = sessionId
    let assistantText = ""
    let completed = false

    try {
      await streamChat(
        message,
        sessionId,
        {
          signal: controller.signal,
          onSession: (id) => {
            activeSessionId = id
            setSessionId(id)
            // User turn is already persisted on the server at this point.
            upsertSession({
              session_id: id,
              title: fallbackTitle,
              preview: "",
              updated_at: new Date().toISOString(),
            })
          },
          onToken: (chunk) => {
            assistantText += chunk
            appendToLastAssistant(chunk)
          },
          onDone: (id) => {
            completed = true
            activeSessionId = id
            setSessionId(id)
            replaceLastAssistant({ content: assistantText, status: "done" })
            upsertSession(buildLocalSessionSummary(id, message, assistantText || "…"))
            void queryClient.invalidateQueries({ queryKey: ["sessions"] })

            // Title job is async — poll until the sidebar picks up the LLM title.
            if (isNewSession) {
              titlePollAbortRef.current?.abort()
              const poll = new AbortController()
              titlePollAbortRef.current = poll
              void waitForGeneratedTitle(fallbackTitle, {
                signal: poll.signal,
                fetchSessions: refreshSessions,
                getTitle: () =>
                  useChatStore.getState().sessions.find((s) => s.session_id === id)?.title,
              })
            }
          },
          onError: (detail) => {
            // Option B: show error inline in the assistant bubble (UI-only).
            replaceLastAssistant({
              content: detail || "Failed to generate a reply. Please try again.",
              status: "error",
            })
          },
        },
        selectedModel,
      )
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        if (!assistantText) {
          removeLastEmptyAssistant()
        } else {
          replaceLastAssistant({ content: assistantText, status: "cancelled" })
        }
      } else {
        // onError already replaced the bubble for SSE errors; cover HTTP/network throws.
        const detail = (error as Error).message || "Failed to send message"
        replaceLastAssistant({ content: detail, status: "error" })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
      if (activeSessionId && !completed) {
        // Refresh sidebar after abort/error — user message is in Firestore.
        upsertSession({
          session_id: activeSessionId,
          title: fallbackTitle,
          preview: assistantText ? titleFromMessage(assistantText) : "",
          updated_at: new Date().toISOString(),
        })
        void queryClient.invalidateQueries({ queryKey: ["sessions"] })
      }
    }
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void handleSubmit()
    }
  }

  function handlePromptSelect(promptText: string) {
    if (isStreaming || !user) return
    setDraft(promptText)
    textareaRef.current?.focus()
  }

  async function handleSelectSession(id: string) {
    if (!user || id === sessionId || loadingSessionId) return
    setLoadError(null)
    setLoadingSessionId(id)
    try {
      const history = await getSession(id)
      const chatMessages = history.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      loadConversation(history.session_id, chatMessages)
      // Do not overwrite server/LLM titles from the first user message.
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
    abortRef.current?.abort()
    titlePollAbortRef.current?.abort()
    resetConversation()
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
      void queryClient.invalidateQueries({ queryKey: ["sessions"] })
    } catch (error) {
      setLoadError((error as Error).message || "Failed to delete chat")
    } finally {
      setDeletingSessionId(null)
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return <LandingPage />
  }

  if (!user.emailVerified && user.providerData.some((p) => p.providerId === "password")) {
    return <EmailVerificationPage />
  }

  const displaySessions = user ? sessions : []
  const inputDisabled = isStreaming || Boolean(loadingSessionId) || !user || authLoading

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
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MessageList
            messages={messages}
            isPending={isStreaming}
            onSelectPrompt={handlePromptSelect}
          />
          <div ref={bottomRef} />
        </main>

        <footer className="w-full shrink-0 pb-4 pt-2 px-3 sm:px-4">
          <div className="mx-auto max-w-3xl">
            {!user && !authLoading ? (
              <p className="mb-2 text-center text-xs text-muted-foreground">
                Sign in from the sidebar to chat and save history.
              </p>
            ) : null}
            {loadError ? (
              <p className="mb-2 text-center text-xs text-destructive">{loadError}</p>
            ) : null}

            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="relative flex flex-col rounded-2xl border border-border/80 bg-card p-3 shadow-lg transition-all focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40"
            >
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={user ? "Type your message here..." : "Sign in to start chatting..."}
                rows={1}
                disabled={inputDisabled}
                className="w-full resize-none border-0 bg-transparent px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 min-h-[44px] max-h-[160px]"
              />

              <div className="flex items-center justify-between pt-2 px-1 border-t border-border/30">
                <div className="flex items-center gap-2">
                  <ModelPicker
                    models={catalog?.models ?? []}
                    selectedId={selectedModel}
                    loading={modelsQuery.isPending}
                    error={modelsQuery.isError}
                    disabled={isStreaming || Boolean(loadingSessionId)}
                    onSelect={setSelectedModel}
                  />
                </div>

                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition-all hover:bg-destructive/90"
                    title="Stop generating"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={inputDisabled || !draft.trim()}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-30 disabled:hover:bg-primary"
                    title="Send message"
                  >
                    {authLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </footer>
      </div>
    </div>
  )
}

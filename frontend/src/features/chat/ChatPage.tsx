import { useMutation } from "@tanstack/react-query"
import { Loader2, RotateCcw, SendHorizontal } from "lucide-react"
import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageList } from "@/features/chat/MessageList"
import { postChat } from "@/lib/api"
import { useChatStore } from "@/stores/chatStore"

export function ChatPage() {
  const {
    sessionId,
    messages,
    draft,
    setDraft,
    setSessionId,
    addMessage,
    resetConversation,
  } = useChatStore()
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const mutation = useMutation({
    mutationFn: async (message: string) => postChat(message, sessionId),
    onSuccess: (data, message) => {
      addMessage({ role: "user", content: message })
      addMessage({ role: "assistant", content: data.reply })
      setSessionId(data.session_id)
      setDraft("")
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, mutation.isPending])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || mutation.isPending) {
      return
    }
    mutation.mutate(message)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      const message = draft.trim()
      if (!message || mutation.isPending) {
        return
      }
      mutation.mutate(message)
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            GCP Chatbot
          </p>
          <h1 className="font-display text-3xl tracking-tight text-foreground">
            Phase-1 Q/A
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            FastAPI + LiteLLM + Firestore history
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            resetConversation()
            mutation.reset()
          }}
        >
          <RotateCcw className="h-4 w-4" />
          New chat
        </Button>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm backdrop-blur">
        <MessageList messages={messages} isPending={mutation.isPending} />
        <div ref={bottomRef} />

        <form
          onSubmit={handleSubmit}
          className="border-t border-border bg-card/90 p-4"
        >
          {mutation.isError ? (
            <p className="mb-3 text-sm text-destructive">
              {(mutation.error as Error).message || "Failed to send message"}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
              disabled={mutation.isPending}
              className="min-h-[96px] resize-none"
            />
            <Button
              type="submit"
              size="lg"
              disabled={mutation.isPending || !draft.trim()}
              className="sm:min-w-28"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
              Send
            </Button>
          </div>
          {sessionId ? (
            <p className="mt-2 truncate text-xs text-muted-foreground">
              Session: {sessionId}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  )
}

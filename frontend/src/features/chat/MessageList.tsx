import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/api"

type MessageListProps = {
  messages: ChatMessage[]
  isPending: boolean
}

export function MessageList({ messages, isPending }: MessageListProps) {
  if (messages.length === 0 && !isPending) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-2">
          <h2 className="font-display text-2xl tracking-tight text-foreground">
            Ask anything
          </h2>
          <p className="text-sm text-muted-foreground">
            Start a conversation. Follow-ups reuse the same session so the API can
            load prior turns from Firestore.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-6 sm:px-6">
      {messages.map((message, index) => (
        <div
          key={`${message.role}-${index}-${message.content.slice(0, 16)}`}
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
            message.role === "user"
              ? "ml-auto bg-user text-primary-foreground"
              : "mr-auto bg-assistant text-foreground",
          )}
        >
          {message.content}
        </div>
      ))}
      {isPending ? (
        <div className="mr-auto max-w-[85%] rounded-2xl bg-assistant px-4 py-3 text-sm text-muted-foreground">
          Thinking…
        </div>
      ) : null}
    </div>
  )
}

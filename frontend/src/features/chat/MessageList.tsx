import { Sparkles, BookOpen, Code2, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/api"

type MessageListProps = {
  messages: ChatMessage[]
  isPending: boolean
  onSelectPrompt?: (prompt: string) => void
}

const SAMPLE_PROMPTS = [
  "How does AI work?",
  "Are black holes real?",
  'How many Rs are in the word "strawberry"?',
  "What is the meaning of life?",
]

export function MessageList({ messages, isPending, onSelectPrompt }: MessageListProps) {
  if (messages.length === 0 && !isPending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center animate-in fade-in duration-300">
        <div className="w-full max-w-xl space-y-6">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            How can I help you today?
          </h1>

          {/* Action pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onSelectPrompt?.("Create a short story about space exploration")}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3.5 py-1.5 text-xs font-medium text-foreground/80 hover:bg-card hover:text-foreground transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-pink-400" />
              Create
            </button>
            <button
              type="button"
              onClick={() => onSelectPrompt?.("Explain quantum computing in simple terms")}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3.5 py-1.5 text-xs font-medium text-foreground/80 hover:bg-card hover:text-foreground transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5 text-purple-400" />
              Explore
            </button>
            <button
              type="button"
              onClick={() => onSelectPrompt?.("Write a Python function to solve binary search")}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3.5 py-1.5 text-xs font-medium text-foreground/80 hover:bg-card hover:text-foreground transition-colors"
            >
              <Code2 className="h-3.5 w-3.5 text-emerald-400" />
              Code
            </button>
            <button
              type="button"
              onClick={() => onSelectPrompt?.("What are the core concepts of machine learning?")}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3.5 py-1.5 text-xs font-medium text-foreground/80 hover:bg-card hover:text-foreground transition-colors"
            >
              <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
              Learn
            </button>
          </div>

          {/* Sample Prompts List */}
          <div className="pt-4 divide-y divide-border/60 text-left border-t border-b border-border/60">
            {SAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onSelectPrompt?.(prompt)}
                className="w-full py-3 px-2 text-sm text-foreground/80 hover:text-foreground transition-colors hover:bg-card/40 rounded-sm block text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-6">
      {messages.map((message, index) => (
        <div
          key={`${message.role}-${index}-${message.content.slice(0, 24)}`}
          className={cn(
            "max-w-[min(90%,44rem)] rounded-2xl px-4.5 py-3 text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300",
            message.role === "user"
              ? "ml-auto bg-user text-foreground border border-border/80 shadow-xs"
              : "mr-auto bg-assistant/60 text-foreground border border-border/50",
          )}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
      ))}
      {isPending ? (
        <div className="mr-auto flex max-w-[90%] items-center gap-2 rounded-2xl border border-border/50 bg-assistant/60 px-4.5 py-3 text-sm text-muted-foreground">
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pink-400" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pink-400 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pink-400 [animation-delay:300ms]" />
          </span>
          Thinking…
        </div>
      ) : null}
    </div>
  )
}


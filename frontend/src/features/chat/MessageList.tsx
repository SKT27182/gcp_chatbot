import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Sparkles, BookOpen, Code2, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/api"

type MessageListProps = {
  messages: ChatMessage[]
  isPending: boolean
  onSelectPrompt?: (prompt: string) => void
}

type CategoryId = "create" | "explore" | "code" | "learn"

const CATEGORIES = [
  {
    id: "create" as CategoryId,
    label: "Create",
    icon: Sparkles,
    iconColor: "text-pink-400",
    prompts: [
      "Write a short story about space exploration",
      "Draft a professional email requesting project updates",
      "Create a catchy tagline for an AI chatbot app",
      "Generate an outline for a tech blog post",
    ],
  },
  {
    id: "explore" as CategoryId,
    label: "Explore",
    icon: BookOpen,
    iconColor: "text-purple-400",
    prompts: [
      "How does AI work?",
      "Are black holes real?",
      "What is the quantum computing revolution?",
      "Explain how optical fibers transmit data",
    ],
  },
  {
    id: "code" as CategoryId,
    label: "Code",
    icon: Code2,
    iconColor: "text-emerald-400",
    prompts: [
      "Write a Python function to solve binary search",
      "How to handle async errors in JavaScript?",
      "Explain Docker containers vs Virtual Machines",
      "How do I optimize SQL queries with indexes?",
    ],
  },
  {
    id: "learn" as CategoryId,
    label: "Learn",
    icon: GraduationCap,
    iconColor: "text-blue-400",
    prompts: [
      "What are the core concepts of machine learning?",
      'How many Rs are in the word "strawberry"?',
      "What is the difference between REST and GraphQL?",
      "What is the meaning of life?",
    ],
  },
]

const DEFAULT_PROMPTS = [
  "How does AI work?",
  "Are black holes real?",
  'How many Rs are in the word "strawberry"?',
  "What is the meaning of life?",
]

export function MessageList({ messages, isPending, onSelectPrompt }: MessageListProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null)

  const activeCategory = CATEGORIES.find((c) => c.id === selectedCategory)
  const currentPrompts = activeCategory ? activeCategory.prompts : DEFAULT_PROMPTS

  function handleCategoryClick(id: CategoryId) {
    setSelectedCategory((prev) => (prev === id ? null : id))
  }

  if (messages.length === 0 && !isPending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center animate-in fade-in duration-300">
        <div className="w-full max-w-xl space-y-6">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            How can I help you today?
          </h1>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const isSelected = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryClick(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                    isSelected
                      ? "border-primary bg-primary/20 text-foreground shadow-xs ring-1 ring-primary/40"
                      : "border-border bg-card/50 text-foreground/80 hover:bg-card hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", cat.iconColor)} />
                  {cat.label}
                </button>
              )
            })}
          </div>

          {/* Sample Prompts List */}
          <div className="pt-2">
            {selectedCategory ? (
              <p className="pb-2 text-left text-xs font-medium text-muted-foreground">
                Showing prompts for <span className="capitalize text-foreground font-semibold">{selectedCategory}</span>:
              </p>
            ) : null}
            <div className="divide-y divide-border/60 text-left border-t border-b border-border/60">
              {currentPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSelectPrompt?.(prompt)}
                  className="w-full py-3 px-2 text-sm text-foreground/85 hover:text-foreground hover:bg-card/40 transition-colors rounded-sm block text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
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
            "max-w-[min(90%,44rem)] rounded-2xl px-4.5 py-3.5 text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300",
            message.role === "user"
              ? "ml-auto bg-user text-foreground border border-border/80 shadow-xs"
              : "mr-auto bg-assistant/60 text-foreground border border-border/50",
          )}
        >
          {message.role === "user" ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl font-bold tracking-tight text-foreground mt-4 mb-2 border-b border-border/40 pb-1">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold tracking-tight text-foreground mt-3.5 mb-2">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold text-foreground mt-3 mb-1.5">
                    {children}
                  </h3>
                ),
                p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
                ul: ({ children }) => (
                  <ul className="list-disc pl-5 mb-2.5 space-y-1 text-foreground/90">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-5 mb-2.5 space-y-1 text-foreground/90">{children}</ol>
                ),
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                hr: () => <hr className="my-4 border-border/60" />,
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ className, children, ...props }: any) => {
                  const isInline = !className && !String(children).includes("\n")
                  if (isInline) {
                    return (
                      <code
                        className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-xs text-pink-300"
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  }
                  return (
                    <pre className="my-3 overflow-x-auto rounded-xl border border-border/80 bg-muted/50 p-3.5 font-mono text-xs leading-relaxed text-foreground">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  )
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-primary/70 pl-3.5 my-2.5 text-muted-foreground italic">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="my-3 overflow-x-auto rounded-lg border border-border/70">
                    <table className="w-full text-left text-xs border-collapse">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="bg-muted/60 p-2.5 font-semibold border-b border-border/70 text-foreground">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="p-2.5 border-b border-border/40 text-foreground/90">{children}</td>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
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



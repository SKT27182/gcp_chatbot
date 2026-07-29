import { useState, useMemo } from "react"
import {
  Loader2,
  MessageSquarePlus,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SessionSummary } from "@/lib/api"
import { useThemeStore } from "@/stores/themeStore"

type ChatSidebarProps = {
  open: boolean
  sessions: SessionSummary[]
  activeSessionId: string | null
  loadingSessionId: string | null
  deletingSessionId: string | null
  onNewChat: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onToggleSidebar: () => void
}

type GroupedSessions = {
  today: SessionSummary[]
  last7Days: SessionSummary[]
  older: SessionSummary[]
}

function groupSessionsByDate(sessions: SessionSummary[], query: string): GroupedSessions {
  const filtered = query
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          (s.preview && s.preview.toLowerCase().includes(query.toLowerCase())),
      )
    : sessions

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000

  const today: SessionSummary[] = []
  const last7Days: SessionSummary[] = []
  const older: SessionSummary[] = []

  for (const session of filtered) {
    if (!session.updated_at) {
      older.push(session)
      continue
    }
    const time = new Date(session.updated_at).getTime()
    if (Number.isNaN(time)) {
      older.push(session)
    } else if (time >= startOfToday) {
      today.push(session)
    } else if (time >= sevenDaysAgo) {
      last7Days.push(session)
    } else {
      older.push(session)
    }
  }

  return { today, last7Days, older }
}

export function ChatSidebar({
  open,
  sessions,
  activeSessionId,
  loadingSessionId,
  deletingSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onToggleSidebar,
}: ChatSidebarProps) {
  const { theme, toggleTheme } = useThemeStore()
  const [searchQuery, setSearchQuery] = useState("")

  const grouped = useMemo(
    () => groupSessionsByDate(sessions, searchQuery),
    [sessions, searchQuery],
  )

  const hasAnySessions = sessions.length > 0
  const isSearchEmpty =
    searchQuery &&
    grouped.today.length === 0 &&
    grouped.last7Days.length === 0 &&
    grouped.older.length === 0

  return (
    <>
      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="Close sidebar"
        className={cn(
          "fixed inset-0 z-30 bg-black/60 backdrop-blur-xs transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onToggleSidebar}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-68 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-all duration-300 ease-out md:static md:z-0 md:shadow-none",
          open
            ? "translate-x-0"
            : "-translate-x-full md:w-0 md:translate-x-0 md:border-0 md:overflow-hidden",
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground/80 hover:text-sidebar-foreground"
              onClick={onToggleSidebar}
              aria-label="Toggle sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-lg tracking-tight text-sidebar-foreground">
              ChatBot
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/80 hover:text-sidebar-foreground"
            onClick={onNewChat}
            title="New Chat"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>

        {/* New Chat Button */}
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99]"
          >
            New Chat
          </button>
        </div>

        {/* Search input */}
        <div className="px-3 pb-2 pt-1">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your threads..."
              className="w-full rounded-lg border border-sidebar-border bg-sidebar-accent/50 py-1.5 pl-8 pr-3 text-xs text-sidebar-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Sessions list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 space-y-4">
          {!hasAnySessions ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              No conversations yet.
            </div>
          ) : isSearchEmpty ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              No matching threads found.
            </div>
          ) : (
            <>
              {grouped.today.length > 0 && (
                <div>
                  <p className="px-2.5 pb-1.5 text-[11px] font-semibold text-pink-400/90 dark:text-pink-400/80">
                    Today
                  </p>
                  <ul className="space-y-0.5">
                    {grouped.today.map((session) => (
                      <SessionItem
                        key={session.session_id}
                        session={session}
                        active={session.session_id === activeSessionId}
                        loading={session.session_id === loadingSessionId}
                        deleting={session.session_id === deletingSessionId}
                        onSelect={onSelectSession}
                        onDelete={onDeleteSession}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {grouped.last7Days.length > 0 && (
                <div>
                  <p className="px-2.5 pb-1.5 text-[11px] font-semibold text-pink-400/90 dark:text-pink-400/80">
                    Last 7 Days
                  </p>
                  <ul className="space-y-0.5">
                    {grouped.last7Days.map((session) => (
                      <SessionItem
                        key={session.session_id}
                        session={session}
                        active={session.session_id === activeSessionId}
                        loading={session.session_id === loadingSessionId}
                        deleting={session.session_id === deletingSessionId}
                        onSelect={onSelectSession}
                        onDelete={onDeleteSession}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {grouped.older.length > 0 && (
                <div>
                  <p className="px-2.5 pb-1.5 text-[11px] font-semibold text-muted-foreground">
                    Older
                  </p>
                  <ul className="space-y-0.5">
                    {grouped.older.map((session) => (
                      <SessionItem
                        key={session.session_id}
                        session={session}
                        active={session.session_id === activeSessionId}
                        loading={session.session_id === loadingSessionId}
                        deleting={session.session_id === deletingSessionId}
                        onSelect={onSelectSession}
                        onDelete={onDeleteSession}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="flex items-center justify-between border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/40 text-xs font-semibold text-foreground">
              G
            </div>
            <span className="truncate text-xs font-medium text-sidebar-foreground">
              Guest User
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
            onClick={toggleTheme}
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </aside>


      {!open ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="fixed left-3 top-3 z-20 h-9 w-9 text-muted-foreground hover:text-foreground md:left-4 md:top-3.5"
          onClick={onToggleSidebar}
          aria-label="Open sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      ) : null}
    </>
  )
}

function SessionItem({
  session,
  active,
  loading,
  deleting,
  onSelect,
  onDelete,
}: {
  session: SessionSummary
  active: boolean
  loading: boolean
  deleting: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onSelect(session.session_id)}
        disabled={deleting}
        className={cn(
          "w-full rounded-lg py-1.5 pl-2.5 pr-8 text-left text-xs transition-colors",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          (loading || deleting) && "opacity-60",
        )}
      >
        <span className="block truncate">{session.title || "Untitled Chat"}</span>
      </button>
      <button
        type="button"
        title="Delete chat"
        aria-label={`Delete ${session.title || "chat"}`}
        disabled={deleting}
        onClick={(event) => {
          event.stopPropagation()
          onDelete(session.session_id)
        }}
        className={cn(
          "absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive",
          "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
          deleting && "opacity-100",
        )}
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </li>
  )
}


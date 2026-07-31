import { useMemo, useState } from "react"
import {
  Loader2,
  LogOut,
  MessageSquarePlus,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsModal } from "@/components/SettingsModal"
import { cn } from "@/lib/utils"
import type { SessionSummary } from "@/lib/api"
import { useAuthStore } from "@/stores/authStore"
import { useThemeStore } from "@/stores/themeStore"
import { maskEmail } from "@/lib/stringUtils"

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
  const { user, loading: authLoading, logout } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  const maskedUserEmail = maskEmail(user?.email)
  const avatarLetter = (maskedUserEmail[0] || "?").toUpperCase()

  return (
    <>
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
            disabled={!user}
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-3 py-2">
          <button
            type="button"
            onClick={onNewChat}
            disabled={!user}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-40"
          >
            New Chat
          </button>
        </div>

        {user ? (
          <>
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

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 space-y-4">
              {!hasAnySessions ? (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No conversations yet.
                </div>
              ) : isSearchEmpty ? (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No matches.
                </div>
              ) : (
                <>
                  <SessionGroup
                    label="Today"
                    sessions={grouped.today}
                    activeSessionId={activeSessionId}
                    loadingSessionId={loadingSessionId}
                    deletingSessionId={deletingSessionId}
                    onSelectSession={onSelectSession}
                    onDeleteSession={onDeleteSession}
                  />
                  <SessionGroup
                    label="Last 7 Days"
                    sessions={grouped.last7Days}
                    activeSessionId={activeSessionId}
                    loadingSessionId={loadingSessionId}
                    deletingSessionId={deletingSessionId}
                    onSelectSession={onSelectSession}
                    onDeleteSession={onDeleteSession}
                  />
                  <SessionGroup
                    label="Older"
                    sessions={grouped.older}
                    activeSessionId={activeSessionId}
                    loadingSessionId={loadingSessionId}
                    deletingSessionId={deletingSessionId}
                    onSelectSession={onSelectSession}
                    onDeleteSession={onDeleteSession}
                  />
                </>
              )}
            </div>
          </>
        ) : null}

        <div className="flex items-center justify-between border-t border-sidebar-border p-3">
          <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/30 text-xs font-semibold text-foreground">
              {avatarLetter}
            </div>
            <span className="truncate text-xs font-medium text-sidebar-foreground">
              {authLoading ? "…" : maskedUserEmail}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            {user ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                  onClick={() => setSettingsOpen(true)}
                  title="Settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-sidebar-foreground"
                  onClick={() => void logout()}
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : null}
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
        </div>
      </aside>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

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

function SessionGroup({
  label,
  sessions,
  activeSessionId,
  loadingSessionId,
  deletingSessionId,
  onSelectSession,
  onDeleteSession,
}: {
  label: string
  sessions: SessionSummary[]
  activeSessionId: string | null
  loadingSessionId: string | null
  deletingSessionId: string | null
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
}) {
  if (sessions.length === 0) return null
  return (
    <div>
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-0.5">
        {sessions.map((session) => (
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
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </button>
    </li>
  )
}

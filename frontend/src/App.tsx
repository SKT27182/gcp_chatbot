import { QueryClientProvider } from "@tanstack/react-query"
import { useEffect } from "react"
import { ChatPage } from "@/features/chat/ChatPage"
import { queryClient } from "@/lib/queryClient"
import { useAuthStore } from "@/stores/authStore"
import { useThemeStore } from "@/stores/themeStore"

function ThemeBoot() {
  const theme = useThemeStore((s) => s.theme)
  const colorScheme = useThemeStore((s) => s.colorScheme)
  const customColor = useThemeStore((s) => s.customColor)
  const customBgColor = useThemeStore((s) => s.customBgColor)

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
      if (customBgColor) {
        root.style.setProperty("--color-background", customBgColor)
      } else {
        root.style.removeProperty("--color-background")
      }
    } else {
      root.classList.remove("dark")
      // Ensure all inline dark overrides are removed in Light mode
      root.style.removeProperty("--color-background")
      root.style.removeProperty("--color-card")
      root.style.removeProperty("--color-sidebar")
      root.style.removeProperty("--color-muted")
      root.style.removeProperty("--color-border")
      root.style.removeProperty("--color-foreground")
      root.style.removeProperty("--color-card-foreground")
      root.style.removeProperty("--color-sidebar-foreground")
      root.style.removeProperty("--color-muted-foreground")
    }
    root.style.colorScheme = theme

    if (customColor) {
      root.setAttribute("data-color-scheme", "custom")
      root.style.setProperty("--color-primary", customColor)
      root.style.setProperty("--color-ring", customColor)
      root.style.setProperty("--color-accent-glow", customColor)
    } else {
      root.setAttribute("data-color-scheme", colorScheme)
    }
  }, [theme, colorScheme, customColor, customBgColor])
  return null
}

function AuthBoot() {
  const init = useAuthStore((s) => s.init)
  useEffect(() => init(), [init])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeBoot />
      <AuthBoot />
      <main className="h-full">
        <ChatPage />
      </main>
    </QueryClientProvider>
  )
}

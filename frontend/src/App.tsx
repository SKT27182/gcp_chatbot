import { QueryClientProvider } from "@tanstack/react-query"
import { useEffect } from "react"
import { ChatPage } from "@/features/chat/ChatPage"
import { queryClient } from "@/lib/queryClient"
import { useThemeStore } from "@/stores/themeStore"

function ThemeBoot() {
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
    root.style.colorScheme = theme
  }, [theme])
  return null
}


export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeBoot />
      <main className="h-full">
        <ChatPage />
      </main>
    </QueryClientProvider>
  )
}

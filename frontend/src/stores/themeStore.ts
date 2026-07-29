import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ThemeMode = "light" | "dark"

type ThemeState = {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
  root.style.colorScheme = theme
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      toggleTheme: () => {
        const next = get().theme === "light" ? "dark" : "light"
        applyTheme(next)
        set({ theme: next })
      },
    }),
    {
      name: "gcp-chatbot-theme",
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.theme ?? "dark")
      },
    },
  ),
)


import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ThemeMode = "light" | "dark"
export type ColorScheme = "cyan" | "violet" | "emerald" | "amber" | "rose" | "plum"

export const COLOR_SCHEMES: { id: ColorScheme; name: string; color: string }[] = [
  { id: "cyan", name: "Electric Cyan", color: "#38bdf8" },
  { id: "violet", name: "Neon Violet", color: "#a855f7" },
  { id: "emerald", name: "Emerald Green", color: "#10b981" },
  { id: "amber", name: "Warm Amber", color: "#f59e0b" },
  { id: "rose", name: "Rose Red", color: "#f43f5e" },
  { id: "plum", name: "Deep Plum", color: "#8a306c" },
]

export const BG_PRESETS: { id: string; name: string; color: string }[] = [
  { id: "forest", name: "Forest Green", color: "#263e0f" },
  { id: "charcoal", name: "Dark Charcoal", color: "#121212" },
  { id: "navy", name: "Slate Navy", color: "#0f172a" },
  { id: "midnight", name: "Deep Midnight", color: "#141018" },
  { id: "emerald", name: "Dark Emerald", color: "#091e14" },
  { id: "indigo", name: "Deep Indigo", color: "#1e1b4b" },
]

type ThemeState = {
  theme: ThemeMode
  colorScheme: ColorScheme
  customColor: string | null
  customBgColor: string | null
  setTheme: (theme: ThemeMode) => void
  setColorScheme: (scheme: ColorScheme) => void
  setCustomColor: (color: string) => void
  setCustomBgColor: (color: string | null) => void
  toggleTheme: () => void
}

function adjustHexColor(hex: string, percent: number): string {
  const cleanHex = hex.replace("#", "")
  if (cleanHex.length !== 6) return hex
  const num = parseInt(cleanHex, 16)
  if (isNaN(num)) return hex
  let r = (num >> 16) + percent
  let g = ((num >> 8) & 0x00ff) + percent
  let b = (num & 0x0000ff) + percent
  r = Math.min(255, Math.max(0, r))
  g = Math.min(255, Math.max(0, g))
  b = Math.min(255, Math.max(0, b))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

function applyTheme(
  theme: ThemeMode,
  colorScheme: ColorScheme,
  customColor: string | null,
  customBgColor: string | null,
) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
  root.style.colorScheme = theme

  if (customColor) {
    root.setAttribute("data-color-scheme", "custom")
    root.style.setProperty("--color-primary", customColor)
    root.style.setProperty("--color-ring", customColor)
    root.style.setProperty("--color-accent-glow", customColor)
    const isDark = theme === "dark"
    root.style.setProperty("--color-user", isDark ? `${customColor}33` : `${customColor}20`)
    root.style.setProperty("--color-sidebar-accent", isDark ? `${customColor}26` : `${customColor}18`)
  } else {
    root.setAttribute("data-color-scheme", colorScheme)
    root.style.removeProperty("--color-primary")
    root.style.removeProperty("--color-ring")
    root.style.removeProperty("--color-accent-glow")
    root.style.removeProperty("--color-user")
    root.style.removeProperty("--color-sidebar-accent")
  }

  if (theme === "dark" && customBgColor) {
    root.style.setProperty("--color-background", customBgColor)
    root.style.setProperty("--color-card", adjustHexColor(customBgColor, 6))
    root.style.setProperty("--color-sidebar", customBgColor)
    root.style.setProperty("--color-muted", adjustHexColor(customBgColor, 12))
    root.style.setProperty("--color-border", adjustHexColor(customBgColor, 25))
    root.style.setProperty("--color-foreground", "#ffffff")
    root.style.setProperty("--color-card-foreground", "#ffffff")
    root.style.setProperty("--color-sidebar-foreground", "#ffffff")
    root.style.setProperty("--color-muted-foreground", "#e2e8f0")
  } else {
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
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      colorScheme: "cyan",
      customColor: null,
      customBgColor: "#121212",
      setTheme: (theme) => {
        applyTheme(theme, get().colorScheme, get().customColor, get().customBgColor)
        set({ theme })
      },
      setColorScheme: (colorScheme) => {
        applyTheme(get().theme, colorScheme, null, get().customBgColor)
        set({ colorScheme, customColor: null })
      },
      setCustomColor: (customColor) => {
        applyTheme(get().theme, get().colorScheme, customColor, get().customBgColor)
        set({ customColor })
      },
      setCustomBgColor: (customBgColor) => {
        applyTheme(get().theme, get().colorScheme, get().customColor, customBgColor)
        set({ customBgColor })
      },
      toggleTheme: () => {
        const nextTheme = get().theme === "light" ? "dark" : "light"
        applyTheme(nextTheme, get().colorScheme, get().customColor, get().customBgColor)
        set({ theme: nextTheme })
      },
    }),
    {
      name: "gcp-chatbot-theme",
      onRehydrateStorage: () => (state) => {
        applyTheme(
          state?.theme ?? "dark",
          state?.colorScheme ?? "cyan",
          state?.customColor ?? null,
          state?.customBgColor ?? "#121212",
        )
      },
    },
  ),
)



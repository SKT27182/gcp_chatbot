import { useState, type FormEvent } from "react"
import {
  Check,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Moon,
  Palette,
  Shield,
  Sun,
  X,
} from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { BG_PRESETS, COLOR_SCHEMES, useThemeStore } from "@/stores/themeStore"
import { maskEmail } from "@/lib/stringUtils"

type SettingsModalProps = {
  open: boolean
  onClose: () => void
}

type Tab = "account" | "appearance"

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { user, requestEmailChange, changePassword } = useAuthStore()
  const {
    theme,
    colorScheme,
    customColor,
    customBgColor,
    setColorScheme,
    setCustomColor,
    setCustomBgColor,
    toggleTheme,
  } = useThemeStore()

  const [activeTab, setActiveTab] = useState<Tab>("account")
  
  // Change Email state
  const [newEmail, setNewEmail] = useState("")
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  if (!open) return null

  async function handleEmailChange(e: FormEvent) {
    e.preventDefault()
    setEmailBusy(true)
    setEmailMessage(null)
    setEmailError(null)

    try {
      await requestEmailChange(newEmail.trim())
      setEmailMessage(`Verification link sent to ${maskEmail(newEmail)}. Please verify your new email to complete the change.`)
      setNewEmail("")
    } catch (err) {
      setEmailError((err as Error).message || "Failed to request email change")
    } finally {
      setEmailBusy(false)
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setPasswordBusy(true)
    setPasswordMessage(null)
    setPasswordError(null)

    try {
      await changePassword(currentPassword, newPassword)
      setPasswordMessage("Password successfully updated!")
      setCurrentPassword("")
      setNewPassword("")
    } catch (err) {
      setPasswordError((err as Error).message || "Failed to change password")
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Dialog Box */}
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-2">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Settings</h2>
              <p className="text-xs text-muted-foreground">Manage your account & visual preferences</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="mt-4 flex rounded-xl border border-border/60 bg-muted/40 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("account")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 font-medium transition-all ${
              activeTab === "account"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            Account & Security
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("appearance")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 font-medium transition-all ${
              activeTab === "appearance"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            Appearance & Colors
          </button>
        </div>

        {/* Content Area */}
        <div className="mt-6 max-h-[60vh] overflow-y-auto pr-1 space-y-6">
          {activeTab === "account" ? (
            <>
              {/* Email Section */}
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Change Email Address
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Current Email: <span className="font-semibold text-foreground">{maskEmail(user?.email)}</span>
                </p>

                {emailMessage ? (
                  <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{emailMessage}</span>
                  </div>
                ) : null}

                {emailError ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                    {emailError}
                  </div>
                ) : null}

                <form onSubmit={(e) => void handleEmailChange(e)} className="space-y-2 pt-1">
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="New email address"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    disabled={emailBusy || !newEmail.trim()}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all"
                  >
                    {emailBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Request Email Verification Link
                  </button>
                </form>
              </div>

              {/* Password Section */}
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Change Password
                </h4>

                {passwordMessage ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{passwordMessage}</span>
                  </div>
                ) : null}

                {passwordError ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                    {passwordError}
                  </div>
                ) : null}

                <form onSubmit={(e) => void handlePasswordChange(e)} className="space-y-2 pt-1">
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    disabled={passwordBusy || !currentPassword || !newPassword}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all"
                  >
                    {passwordBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Update Password
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              {/* Appearance Mode */}
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Theme Mode</h4>
                  <p className="text-[11px] text-muted-foreground">Switch between Light and Dark interface</p>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="h-3.5 w-3.5 text-amber-400" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="h-3.5 w-3.5 text-indigo-400" />
                      Dark Mode
                    </>
                  )}
                </button>
              </div>

              {/* Accent Color Circular Swatches & Custom Picker */}
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground tracking-tight">Accent color</h4>
                  <p className="text-[11px] text-muted-foreground">Select an accent color or pick your custom theme color</p>
                </div>

                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  {COLOR_SCHEMES.map((scheme) => {
                    const isSelected = !customColor && colorScheme === scheme.id
                    return (
                      <button
                        key={scheme.id}
                        type="button"
                        onClick={() => setColorScheme(scheme.id)}
                        title={scheme.name}
                        className={`group relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 active:scale-95 ${
                          isSelected
                            ? "ring-2 ring-offset-2 ring-offset-card"
                            : "hover:scale-110"
                        }`}
                        style={{
                          backgroundColor: scheme.color,
                          ...(isSelected
                            ? {
                                boxShadow: `0 0 0 2px var(--color-card), 0 0 0 4px ${scheme.color}`,
                              }
                            : {}),
                        }}
                      >
                        {isSelected ? <Check className="h-4 w-4 text-white stroke-[3]" /> : null}
                      </button>
                    )
                  })}

                  {/* Custom Color Wheel Picker */}
                  <div className="relative group">
                    <button
                      type="button"
                      title="Choose custom color"
                      className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 active:scale-95 overflow-hidden ${
                        customColor
                          ? "ring-2 ring-offset-2 ring-offset-card shadow-md"
                          : "hover:scale-110 border border-border"
                      }`}
                      style={{
                        backgroundColor: customColor || "#38bdf8",
                        ...(customColor
                          ? {
                              boxShadow: `0 0 0 2px var(--color-card), 0 0 0 4px ${customColor}`,
                            }
                          : {}),
                      }}
                    >
                      {!customColor ? (
                        <div className="absolute inset-0 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 opacity-90" />
                      ) : null}
                      <input
                        type="color"
                        value={customColor || "#38bdf8"}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                        title="Pick custom theme color"
                      />
                      {customColor ? (
                        <Check className="relative z-10 h-4 w-4 text-white stroke-[3]" />
                      ) : (
                        <span className="relative z-10 text-[10px] font-extrabold text-white drop-shadow-xs">+</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Background Color Swatches & Custom Picker */}
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div>
                  <h4 className="text-sm font-semibold text-white tracking-tight">Background color</h4>
                  <p className="text-[11px] text-slate-300">Select a dark theme background color or pick your own custom shade</p>
                </div>

                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  {BG_PRESETS.map((preset) => {
                    const isSelected = customBgColor?.toLowerCase() === preset.color.toLowerCase()
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setCustomBgColor(preset.color)}
                        title={preset.name}
                        className={`group relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 active:scale-95 border border-border/40 ${
                          isSelected
                            ? "ring-2 ring-offset-2 ring-offset-card"
                            : "hover:scale-110"
                        }`}
                        style={{
                          backgroundColor: preset.color,
                          ...(isSelected
                            ? {
                                boxShadow: `0 0 0 2px var(--color-card), 0 0 0 4px ${preset.color}`,
                              }
                            : {}),
                        }}
                      >
                        {isSelected ? <Check className="h-4 w-4 text-white stroke-[3]" /> : null}
                      </button>
                    )
                  })}

                  {/* Custom Background Color Wheel Picker */}
                  <div className="relative group">
                    <button
                      type="button"
                      title="Choose custom background color"
                      className="relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 active:scale-95 overflow-hidden border border-border/60 hover:scale-110"
                      style={{
                        backgroundColor: customBgColor || "#121212",
                        boxShadow: `0 0 0 2px var(--color-card), 0 0 0 4px ${customBgColor || "#121212"}`,
                      }}
                    >
                      <input
                        type="color"
                        value={customBgColor || "#121212"}
                        onChange={(e) => setCustomBgColor(e.target.value)}
                        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                        title="Pick custom background color"
                      />
                      <span className="relative z-10 text-[11px] font-extrabold text-white drop-shadow-xs">+</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

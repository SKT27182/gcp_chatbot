import { useState, type FormEvent } from "react"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Moon,
  Palette,
  Shield,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { useThemeStore } from "@/stores/themeStore"
import { maskEmail } from "@/lib/stringUtils"

type AuthTab = "signin" | "signup" | "forgot"

export function LandingPage() {
  const { theme, toggleTheme } = useThemeStore()
  const {
    loading,
    error,
    configured,
    clearError,
    signInEmail,
    signUpEmail,
    sendPasswordReset,
    signInGoogle,
    signInGithub,
  } = useAuthStore()

  const [tab, setTab] = useState<AuthTab>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  function handleTabChange(newTab: AuthTab) {
    setTab(newTab)
    clearError()
    setSuccessMessage(null)
  }

  function calculatePasswordStrength(pass: string) {
    if (!pass) return { score: 0, label: "", color: "bg-muted" }
    let score = 0
    if (pass.length >= 8) score++
    if (/[A-Z]/.test(pass)) score++
    if (/[0-9]/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++

    if (score <= 1) return { score: 25, label: "Weak", color: "bg-destructive" }
    if (score === 2) return { score: 50, label: "Fair", color: "bg-amber-500" }
    if (score === 3) return { score: 75, label: "Good", color: "bg-emerald-500" }
    return { score: 100, label: "Strong", color: "bg-emerald-400" }
  }

  const passStrength = calculatePasswordStrength(password)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    clearError()
    setSuccessMessage(null)
    setBusy(true)

    try {
      if (tab === "signin") {
        await signInEmail(email.trim(), password)
      } else if (tab === "signup") {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match")
        }
        await signUpEmail(email.trim(), password)
        setSuccessMessage(`Account created! We've sent a verification link to ${maskEmail(email)}. Please check your inbox.`)
      } else if (tab === "forgot") {
        await sendPasswordReset(email.trim())
        setSuccessMessage(`Password reset email sent to ${maskEmail(email)}. Check your inbox to reset your password.`)
      }
    } catch {
      // Error handled in authStore state
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-y-auto bg-background text-foreground selection:bg-primary/30">
      {/* Background Glow Overlay */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-60" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-accent-glow/20 blur-3xl opacity-50" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Bot className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">AI ChatBot</span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/60 text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground hover:bg-card"
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </header>

      {/* Main Container */}
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center justify-center px-6 py-8 lg:py-16 lg:flex-row lg:items-start lg:gap-16">
        {/* Hero Section */}
        <div className="flex max-w-xl flex-col items-center text-center lg:items-start lg:text-left py-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-medium text-primary shadow-xs backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Next-Gen Enterprise AI Assistant</span>
          </div>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.15]">
            Supercharge your work with{" "}
            <span className="bg-gradient-to-r from-primary via-accent-glow to-primary bg-clip-text text-transparent">
              Smart AI Chat
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Experience real-time AI conversations powered by GCP Vertex AI & LiteLLM. Enjoy persistent chat histories, email verification security, and customizable color themes.
          </p>

          {/* Feature Badges */}
          <div className="mt-8 grid grid-cols-2 gap-4 w-full text-left">
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3.5 backdrop-blur-xs">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-foreground">Verified & Secure</h4>
                <p className="text-[11px] text-muted-foreground">Protected email verification & auth</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3.5 backdrop-blur-xs">
              <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-foreground">Instant Streaming</h4>
                <p className="text-[11px] text-muted-foreground">Ultra-fast token response times</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3.5 backdrop-blur-xs">
              <Palette className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-foreground">Custom Color Themes</h4>
                <p className="text-[11px] text-muted-foreground">7 pre-defined color palettes</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3.5 backdrop-blur-xs">
              <Bot className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-foreground">Multi-Cloud Ready</h4>
                <p className="text-[11px] text-muted-foreground">Portable GCP architecture</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Form Portal */}
        <div className="mt-8 w-full max-w-md lg:mt-0">
          <div className="rounded-3xl border border-border/80 bg-card/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl transition-all">
            {/* Header Tabs */}
            <div className="mb-6 flex rounded-xl border border-border/80 bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => handleTabChange("signin")}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                  tab === "signin"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("signup")}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                  tab === "signup"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign Up
              </button>
            </div>

            {!configured ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400">
                Firebase is not configured. Please add <code className="font-mono">VITE_FIREBASE_*</code> keys to your environment.
              </div>
            ) : (
              <>
                {/* Form Title & Subtitle */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    {tab === "signin" && "Welcome Back"}
                    {tab === "signup" && "Create Your Account"}
                    {tab === "forgot" && "Reset Password"}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tab === "signin" && "Sign in to access your chat history and start conversation."}
                    {tab === "signup" && "Sign up with email to unlock full access to the AI ChatBot."}
                    {tab === "forgot" && "Enter your registered email address to receive a password reset link."}
                  </p>
                </div>

                {successMessage ? (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                    <span>{successMessage}</span>
                  </div>
                ) : null}

                {error ? (
                  <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs font-medium text-destructive animate-in fade-in">
                    {error}
                  </div>
                ) : null}

                {/* Form */}
                <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-10 pr-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {tab !== "forgot" ? (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-xs font-medium text-foreground">Password</label>
                        {tab === "signin" ? (
                          <button
                            type="button"
                            onClick={() => handleTabChange("forgot")}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Forgot password?
                          </button>
                        ) : null}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-10 pr-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      {tab === "signup" && password ? (
                        <div className="mt-2 space-y-1">
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full transition-all duration-300 ${passStrength.color}`}
                              style={{ width: `${passStrength.score}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Password strength: <span className="font-semibold text-foreground">{passStrength.label}</span>
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {tab === "signup" ? (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-foreground">Confirm Password</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-10 pr-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={busy || loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>
                          {tab === "signin" && "Sign In with Email"}
                          {tab === "signup" && "Create Account & Send Verification"}
                          {tab === "forgot" && "Send Reset Link"}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>

                  {tab === "forgot" ? (
                    <button
                      type="button"
                      onClick={() => handleTabChange("signin")}
                      className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground mt-2"
                    >
                      ← Back to Sign In
                    </button>
                  ) : null}
                </form>

                {tab !== "forgot" ? (
                  <>
                    <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      Or continue with
                      <span className="h-px flex-1 bg-border" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={busy || loading}
                        onClick={() => void signInGoogle().catch(() => undefined)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background/40 py-2.5 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.15C3.25 21.3 7.31 24 12 24z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.27C.46 8.2 0 10.04 0 12s.46 3.8 1.27 5.42l4.01-3.15z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.58l4.01 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                          />
                        </svg>
                        Google
                      </button>

                      <button
                        type="button"
                        disabled={busy || loading}
                        onClick={() => void signInGithub().catch(() => undefined)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background/40 py-2.5 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
                      >
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                        GitHub
                      </button>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

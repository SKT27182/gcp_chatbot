import { useEffect, useState } from "react"
import { Loader2, LogOut, MailCheck, RefreshCw, Send } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { maskEmail } from "@/lib/stringUtils"

export function EmailVerificationPage() {
  const { user, sendVerificationEmail, reloadUser, logout } = useAuthStore()
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)

  const masked = maskEmail(user?.email)

  // Auto-poll email verification status every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      void reloadUser().catch(() => undefined)
    }, 3000)
    return () => clearInterval(timer)
  }, [reloadUser])

  async function handleCheckStatus() {
    setChecking(true)
    setResendStatus(null)
    try {
      const isVerified = await reloadUser()
      if (!isVerified) {
        setResendStatus("Email is not verified yet. Please check your inbox and click the verification link.")
      }
    } catch {
      setResendStatus("Error checking verification status. Please try again.")
    } finally {
      setChecking(false)
    }
  }

  async function handleResend() {
    setResending(true)
    setResendStatus(null)
    try {
      await sendVerificationEmail()
      setResendStatus(`Verification link resent to ${masked}. Please check your inbox or spam folder.`)
    } catch (err) {
      setResendStatus((err as Error).message || "Failed to resend verification email.")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background text-foreground p-6">
      {/* Glow Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-primary/20 blur-3xl opacity-60" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border/80 bg-card/80 p-8 shadow-2xl backdrop-blur-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 shadow-inner">
          <MailCheck className="h-8 w-8" />
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-foreground">Verify Your Email Address</h2>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          We sent a verification link to <span className="font-semibold text-foreground">{masked}</span>. You must verify your email before accessing the chat application.
        </p>

        {resendStatus ? (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs font-medium text-primary leading-snug">
            {resendStatus}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={checking}
            onClick={() => void handleCheckStatus()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            I've Verified My Email (Check Status)
          </button>

          <button
            type="button"
            disabled={resending}
            onClick={() => void handleResend()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/50 py-2.5 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Resend Verification Link
          </button>

          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center justify-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors py-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out / Use Another Account
          </button>
        </div>
      </div>
    </div>
  )
}

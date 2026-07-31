import { create } from "zustand"
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  verifyBeforeUpdateEmail,
  type User,
} from "firebase/auth"
import {
  getFirebaseAuth,
  githubProvider,
  googleProvider,
  isFirebaseConfigured,
} from "@/lib/firebase"

type AuthState = {
  user: User | null
  loading: boolean
  error: string | null
  configured: boolean
  init: () => () => void
  clearError: () => void
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (email: string, password: string) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  sendVerificationEmail: () => Promise<void>
  reloadUser: () => Promise<boolean>
  requestEmailChange: (newEmail: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  signInGoogle: () => Promise<void>
  signInGithub: () => Promise<void>
  logout: () => Promise<void>
  getIdToken: () => Promise<string | null>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,
  configured: isFirebaseConfigured(),

  init: () => {
    if (!isFirebaseConfigured()) {
      set({ loading: false, configured: false, user: null })
      return () => undefined
    }
    const auth = getFirebaseAuth()
    const unsub = onAuthStateChanged(auth, (user) => {
      set({ user, loading: false, configured: true, error: null })
    })
    return unsub
  },

  clearError: () => set({ error: null }),

  signInEmail: async (email, password) => {
    set({ error: null, loading: true })
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
    } catch (error) {
      set({ error: (error as Error).message || "Sign-in failed", loading: false })
      throw error
    }
  },

  signUpEmail: async (email, password) => {
    set({ error: null, loading: true })
    try {
      const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
      if (cred.user && !cred.user.emailVerified) {
        try {
          await sendEmailVerification(cred.user)
        } catch {
          // send verification error non-fatal during signup
        }
      }
    } catch (error) {
      set({ error: (error as Error).message || "Sign-up failed", loading: false })
      throw error
    }
  },

  sendPasswordReset: async (email) => {
    set({ error: null })
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email)
    } catch (error) {
      set({ error: (error as Error).message || "Failed to send password reset email", loading: false })
      throw error
    }
  },

  sendVerificationEmail: async () => {
    const user = get().user
    if (!user) throw new Error("No user signed in")
    set({ error: null })
    try {
      await sendEmailVerification(user)
    } catch (error) {
      set({ error: (error as Error).message || "Failed to send verification email" })
      throw error
    }
  },

  reloadUser: async () => {
    const auth = getFirebaseAuth()
    const currentUser = auth.currentUser
    if (!currentUser) return false
    await currentUser.reload()
    try {
      await currentUser.getIdToken(true)
    } catch {
      // ignore token refresh error if offline
    }
    const updatedUser = auth.currentUser
    if (!updatedUser) return false

    // Shallow clone to trigger Zustand equality check and React re-render
    const userCopy = Object.assign(Object.create(Object.getPrototypeOf(updatedUser)), updatedUser)
    set({ user: userCopy })
    return updatedUser.emailVerified
  },

  requestEmailChange: async (newEmail) => {
    const user = get().user
    if (!user) throw new Error("No user signed in")
    set({ error: null })
    try {
      await verifyBeforeUpdateEmail(user, newEmail)
    } catch (error) {
      set({ error: (error as Error).message || "Failed to send email change verification" })
      throw error
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    const user = get().user
    if (!user || !user.email) throw new Error("No user signed in")
    set({ error: null })
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)
    } catch (error) {
      set({ error: (error as Error).message || "Failed to update password" })
      throw error
    }
  },

  signInGoogle: async () => {
    set({ error: null, loading: true })
    try {
      await signInWithPopup(getFirebaseAuth(), googleProvider)
    } catch (error) {
      set({ error: (error as Error).message || "Google sign-in failed", loading: false })
      throw error
    }
  },

  signInGithub: async () => {
    set({ error: null, loading: true })
    try {
      await signInWithPopup(getFirebaseAuth(), githubProvider)
    } catch (error) {
      set({ error: (error as Error).message || "GitHub sign-in failed", loading: false })
      throw error
    }
  },

  logout: async () => {
    set({ error: null })
    await signOut(getFirebaseAuth())
    set({ user: null })
  },

  getIdToken: async () => {
    const user = get().user
    if (!user) return null
    return user.getIdToken()
  },
}))


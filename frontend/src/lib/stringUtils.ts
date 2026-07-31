/**
 * Masks an email address for privacy in the UI.
 * Example: john.doe@gmail.com -> joh***@g***.com
 * Example: user@domain.com -> us***@d***.com
 */
export function maskEmail(email?: string | null): string {
  if (!email || !email.includes("@")) {
    if (!email) return "User"
    if (email.length <= 4) return email.slice(0, 1) + "***"
    return email.slice(0, 3) + "***"
  }

  const [local, domain] = email.split("@")
  let maskedLocal = ""
  if (local.length <= 3) {
    maskedLocal = local.slice(0, 1) + "***"
  } else if (local.length <= 5) {
    maskedLocal = local.slice(0, 2) + "***"
  } else {
    maskedLocal = local.slice(0, 3) + "***"
  }

  const domainParts = domain.split(".")
  let maskedDomain = domain
  if (domainParts.length >= 2) {
    const mainDomain = domainParts[0]
    const ext = domainParts.slice(1).join(".")
    const maskedMain = mainDomain.length <= 2 ? mainDomain.slice(0, 1) + "***" : mainDomain.slice(0, 1) + "***"
    maskedDomain = `${maskedMain}.${ext}`
  } else if (domain.length > 2) {
    maskedDomain = domain.slice(0, 1) + "***"
  }

  return `${maskedLocal}@${maskedDomain}`
}

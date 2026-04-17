import { useEffect, useRef, useState } from "react"
import { handleAuthCallback } from "@/lib/auth"

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Signing you in...")
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) {
      console.log("[auth-callback-page] skipped duplicate effect")
      return
    }

    startedRef.current = true
    console.log("[auth-callback-page] effect-started")

    async function completeLogin() {
      try {
        console.log("[auth-callback-page] completeLogin:start")
        const redirectPath = await handleAuthCallback()
        console.log("[auth-callback-page] completeLogin:resolved", {
          redirectPath,
        })

        console.log("[auth-callback-page] redirecting", { redirectPath })
        window.location.replace(redirectPath)
      } catch {
        console.log("[auth-callback-page] completeLogin:error")
        setMessage("Authentication failed. Redirecting to login...")
        window.setTimeout(() => {
          console.log("[auth-callback-page] redirecting-to-login")
          window.location.replace("/login")
        }, 800)
      }
    }

    void completeLogin()

    return () => {
      console.log("[auth-callback-page] cleanup")
    }
  }, [])

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

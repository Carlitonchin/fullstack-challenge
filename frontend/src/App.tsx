import { useEffect, useState } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import LoginPage from "@/pages/login"
import HomePage from "@/pages/home"
import AuthCallbackPage from "@/pages/auth-callback"
import {
  ensureValidAccessToken,
  getAuthSession,
  redirectToLogin,
  registerAuthFailureHandler,
} from "@/lib/auth"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedHomeRoute() {
  const [status, setStatus] = useState<"checking" | "ready">("checking")

  useEffect(() => {
    let cancelled = false

    async function bootstrapSession() {
      console.log("[protected-home] bootstrap:start", {
        hasSession: Boolean(getAuthSession()),
      })
      if (!getAuthSession()) {
        console.log("[protected-home] bootstrap:no-session")
        redirectToLogin()
        return
      }

      try {
        await ensureValidAccessToken()

        if (!cancelled) {
          console.log("[protected-home] bootstrap:ready")
          setStatus("ready")
        }
      } catch {
        if (!cancelled) {
          console.log("[protected-home] bootstrap:error")
          redirectToLogin()
        }
      }
    }

    void bootstrapSession()

    return () => {
      cancelled = true
    }
  }, [])

  if (status !== "ready") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </div>
    )
  }

  return <HomePage />
}

export function App() {
  useEffect(() => {
    registerAuthFailureHandler(() => {
      queryClient.clear()
    })

    return () => {
      registerAuthFailureHandler(null)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ProtectedHomeRoute />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App

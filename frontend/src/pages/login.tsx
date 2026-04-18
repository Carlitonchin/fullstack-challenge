import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { beginLogin, ensureValidAccessToken, getAuthSession } from "@/lib/auth"

export default function LoginPage() {
  const navigate = useNavigate()
  const [isStartingLogin, setIsStartingLogin] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function bootstrapLoginPage() {
      const session = getAuthSession()

      if (!session) {
        if (!cancelled) {
          setIsBootstrapping(false)
        }
        return
      }

      try {
        await ensureValidAccessToken()

        if (!cancelled) {
          navigate("/", { replace: true })
        }
      } catch {
        if (!cancelled) {
          setIsBootstrapping(false)
        }
      }
    }

    void bootstrapLoginPage()

    return () => {
      cancelled = true
    }
  }, [navigate])

  async function handleLogin() {
    setIsStartingLogin(true)

    try {
      await beginLogin("/")
    } catch {
      setIsStartingLogin(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4">
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-20 w-36 items-center justify-center rounded-2xl bg-primary/10 px-4 ring-1 ring-primary/20">
            <img
              src="/icon.png"
              alt="Crash Game"
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Authenticate with Keycloak to continue.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              This application accepts login only. You will be redirected to the
              configured Keycloak realm and returned here after authentication.
            </p>
          </CardContent>

          <CardFooter>
            <Button
              type="button"
              className="w-full"
              size="lg"
              onClick={() => {
                void handleLogin()
              }}
              disabled={isStartingLogin || isBootstrapping}
            >
              {isBootstrapping
                ? "Checking session..."
                : isStartingLogin
                  ? "Redirecting..."
                  : "Continue with Keycloak"}
            </Button>
          </CardFooter>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Provably fair · Open source
        </p>
      </div>
    </div>
  )
}

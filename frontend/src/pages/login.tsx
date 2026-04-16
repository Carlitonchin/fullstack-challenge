import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"

type FormErrors = {
  username?: string
  password?: string
}

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  function validate(): FormErrors {
    const next: FormErrors = {}
    if (!username.trim()) next.username = "Username is required."
    if (!password) next.password = "Password is required."
    return next
  }

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }))
    setErrors(validate())
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    setTouched({ username: true, password: true })

    if (Object.keys(validationErrors).length > 0) return

    // TODO: call auth API
    console.log("submit", { username, password })
  }

  const showUsernameError = touched.username && !!errors.username
  const showPasswordError = touched.password && !!errors.password

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
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="size-6 text-primary"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground">
            crash.game
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Enter your credentials to continue.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form id="login-form" onSubmit={handleSubmit} noValidate>
              <FieldGroup>
                <Field data-invalid={showUsernameError || undefined}>
                  <FieldLabel htmlFor="username">Username</FieldLabel>
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    placeholder="johndoe"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      if (touched.username) setErrors(validate())
                    }}
                    onBlur={() => handleBlur("username")}
                    aria-invalid={showUsernameError || undefined}
                  />
                  {showUsernameError && (
                    <FieldError>{errors.username}</FieldError>
                  )}
                </Field>

                <Field data-invalid={showPasswordError || undefined}>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (touched.password) setErrors(validate())
                    }}
                    onBlur={() => handleBlur("password")}
                    aria-invalid={showPasswordError || undefined}
                  />
                  {showPasswordError && (
                    <FieldError>{errors.password}</FieldError>
                  )}
                </Field>
              </FieldGroup>
            </form>
          </CardContent>

          <CardFooter>
            <Button
              type="submit"
              form="login-form"
              className="w-full"
              size="lg"
            >
              Continue
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

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchRoundVerification, type RoundVerification } from "@/lib/api"
import { formatMultiplier, truncateHash } from "@/lib/format"

interface VerificationModalProps {
  roundId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VerificationModal({
  roundId,
  open,
  onOpenChange,
}: VerificationModalProps) {
  const query = useQuery<RoundVerification>({
    queryKey: ["round-verification", roundId],
    queryFn: () => fetchRoundVerification(roundId),
    enabled: open && !!roundId,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        className="flex h-[80vh] max-h-[800px] flex-col overflow-hidden"
      >
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base">
                Provably Fair Verification
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                Round {roundId.slice(0, 8)} -{" "}
                {query.data?.crashPoint
                  ? formatMultiplier(query.data.crashPoint)
                  : "Pending"}
              </DialogDescription>
            </div>
            <VerificationBadge isVerified={query.data?.isServerSeedRevealed ?? false} />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1">
          {query.isLoading ? (
            <VerificationSkeleton />
          ) : query.isError ? (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-destructive">
              Failed to load verification data
            </div>
          ) : query.data ? (
            <VerificationContent verification={query.data} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function VerificationBadge({ isVerified }: { isVerified: boolean }) {
  return isVerified ? (
    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
      Verified
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Pending
    </Badge>
  )
}

function VerificationContent({
  verification,
}: {
  verification: RoundVerification
}) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        <StrategySection verification={verification} />
        <Separator />
        <DataSection verification={verification} />
        <Separator />
        <VerificationSection verification={verification} />
      </div>
    </ScrollArea>
  )
}

function StrategySection({
  verification,
}: {
  verification: RoundVerification
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Strategy
        </h4>
        <Badge variant="outline" className="text-xs">
          {verification.strategyDisplayName}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {verification.strategyDescription}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <DataRow label="Algorithm" value={verification.algorithm} />
        <DataRow label="Hash" value={verification.hashAlgorithm} />
        <DataRow
          label="Outcome"
          value={verification.outcomeAlgorithm}
          className="col-span-2"
        />
        <DataRow
          label="House Edge"
          value={verification.houseEdgeDescription}
          className="col-span-2"
        />
      </div>
    </div>
  )
}

function DataSection({
  verification,
}: {
  verification: RoundVerification
}) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Round Data
      </h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <DataRow label="Nonce" value={verification.nonce} />
        <DataRow
          label="Server Seed Hash"
          value={
            <HashWithTooltip hash={verification.serverSeedHash} />
          }
        />
        {verification.serverSeed && (
          <DataRow
            label="Server Seed"
            value={
              <ServerSeedWithTooltip seed={verification.serverSeed} />
            }
          />
        )}
        {verification.crashPoint !== null && (
          <DataRow
            label="Crash Point"
            value={
              <span className="font-semibold text-primary">
                {formatMultiplier(verification.crashPoint)}
              </span>
            }
          />
        )}
        {verification.crashMultiplier !== null && (
          <DataRow
            label="Crash Multiplier"
            value={formatMultiplier(verification.crashMultiplier)}
          />
        )}
      </div>
    </div>
  )
}

function VerificationSection({
  verification,
}: {
  verification: RoundVerification
}) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Verification
      </h4>
      <div className="rounded-md bg-muted/50 p-3">
        <code className="text-xs font-mono leading-relaxed">
          {verification.verificationFormula}
        </code>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">Steps:</p>
        {verification.verificationSteps.map((step) => (
          <div
            key={step.order}
            className="flex items-start gap-2 text-xs"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
              {step.order}
            </span>
            <span className="text-muted-foreground">{step.instruction}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DataRow({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <span className="block text-muted-foreground/70">{label}</span>
      <span className="block">{value}</span>
    </div>
  )
}

function HashWithTooltip({ hash }: { hash: string }) {
  return (
    <CopyTooltipButton value={hash}>
      <code className="cursor-pointer font-mono text-chart-1 hover:underline">
        {truncateHash(hash, 8)}
      </code>
    </CopyTooltipButton>
  )
}

function ServerSeedWithTooltip({ seed }: { seed: string }) {
  return (
    <CopyTooltipButton value={seed}>
      <code className="cursor-pointer font-mono text-chart-1 hover:underline">
        {truncateHash(seed, 8)}
      </code>
    </CopyTooltipButton>
  )
}

function CopyTooltipButton({
  value,
  children,
}: {
  value: string
  children: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          className="text-left"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs break-all">{value}</p>
          <p className="text-[10px] text-muted-foreground">
            {copied ? "✓ Copied!" : "Click to copy"}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function VerificationSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-full" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </div>
      <Separator />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8" />
      </div>
      <Separator />
      <Skeleton className="min-h-0 flex-1" />
    </div>
  )
}

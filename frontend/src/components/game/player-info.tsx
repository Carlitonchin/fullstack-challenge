import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCents } from "@/lib/format"
import type { Wallet, Player } from "@/lib/api"
import { WalletIcon, LogOutIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PlayerInfoProps {
  player: Player | undefined
  wallet: Wallet | undefined
  isLoading: boolean
}

export function PlayerInfo({ player, wallet, isLoading }: PlayerInfoProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-8">
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
          {player?.username.slice(0, 2).toUpperCase() ?? "??"}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col">
        <span className="text-xs font-medium leading-none">
          {player?.username ?? "—"}
        </span>
        <div className="flex items-center gap-1 mt-0.5">
          <WalletIcon className="size-3 text-muted-foreground" />
          <span className="text-xs font-semibold text-primary tabular-nums">
            {wallet ? formatCents(wallet.balanceCents) : "—"}
          </span>
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="ml-auto size-8 p-0">
            <LogOutIcon data-icon="inline-start" />
            <span className="sr-only">Sign out</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Sign out</TooltipContent>
      </Tooltip>
    </div>
  )
}

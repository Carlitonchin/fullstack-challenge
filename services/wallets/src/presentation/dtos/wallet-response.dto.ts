import { ApiProperty } from "@nestjs/swagger";
import { Wallet } from "../../domain/wallet/wallet";

export class WalletResponseDto {
  @ApiProperty({ example: "wallet-1" })
  id!: string;

  @ApiProperty({ example: "player-1" })
  playerId!: string;

  @ApiProperty({ example: "BRL" })
  currency!: string;

  @ApiProperty({ example: "1050" })
  balanceInCents!: string;

  @ApiProperty({ example: "10.50" })
  balance!: string;

  @ApiProperty({ example: "2026-04-15T12:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-04-15T12:05:00.000Z" })
  updatedAt!: string;

  static fromDomain(wallet: Wallet): WalletResponseDto {
    return {
      id: wallet.id,
      playerId: wallet.playerId,
      currency: wallet.currency,
      balanceInCents: wallet.balanceInCents.toString(),
      balance: WalletResponseDto.formatBalance(wallet.balanceInCents),
      createdAt: wallet.createdAt.toISOString(),
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }

  private static formatBalance(amountInCents: bigint): string {
    const normalizedAmount = amountInCents < 0n ? amountInCents * -1n : amountInCents;
    const integerPart = normalizedAmount / 100n;
    const fractionalPart = (normalizedAmount % 100n).toString().padStart(2, "0");
    const sign = amountInCents < 0n ? "-" : "";

    return `${sign}${integerPart.toString()}.${fractionalPart}`;
  }
}

import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { WalletRepository } from "../../infrastructure/repository/wallet.repository";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";
import { WalletResponseDto } from "../dtos/wallet-response.dto";

type AuthenticatedRequest = {
  user?: {
    sub?: string;
  };
};

@ApiTags("wallets")
@Controller()
export class WalletsController {
  constructor(private readonly walletRepository: WalletRepository) {}

  @Get("health")
  @ApiOperation({ summary: "Wallets service health check" })
  @ApiOkResponse({ type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "wallets" };
  }

  @Get("wallets/me")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get the authenticated player's wallet" })
  @ApiOkResponse({ type: WalletResponseDto })
  @ApiNotFoundResponse({ description: "Wallet for the authenticated player was not found" })
  @ApiInternalServerErrorResponse({
    description: "Authenticated player id is missing or wallet reconstruction failed",
  })
  async getMe(@Req() request: AuthenticatedRequest): Promise<WalletResponseDto> {
    const playerId = request.user?.sub?.trim();

    if (!playerId) {
      throw new InternalServerErrorException("Authenticated player id is missing");
    }

    const walletResult = await this.walletRepository.findByPlayerId(playerId);

    if (!walletResult.success) {
      throw new InternalServerErrorException(walletResult.error.message);
    }

    const wallet = walletResult.data;

    if (!wallet) {
      throw new NotFoundException(`Wallet for player ${playerId} was not found`);
    }

    return WalletResponseDto.fromDomain(wallet);
  }
}

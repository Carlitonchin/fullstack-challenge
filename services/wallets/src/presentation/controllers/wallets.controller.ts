import {
  Controller,
  Get,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { GetMyWalletUseCase } from "@wallets/application/use-cases/get-my-wallet.use-case";
import { KeycloakJwtAuthGuard } from "../auth/keycloak-jwt-auth.guard";
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
  constructor(private readonly getMyWalletUseCase: GetMyWalletUseCase) {}

  @Get("health")
  @ApiOperation({ summary: "Wallets service health check" })
  @ApiOkResponse({ type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "wallets" };
  }

  @Get("me")
  @UseGuards(KeycloakJwtAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get the authenticated player's wallet" })
  @ApiOkResponse({ type: WalletResponseDto })
  @ApiNotFoundResponse({ description: "Wallet for the authenticated player was not found" })
  @ApiUnauthorizedResponse({ description: "Bearer token is missing or invalid" })
  @ApiInternalServerErrorResponse({
    description: "Authenticated player id is missing or wallet reconstruction failed",
  })
  async getMe(@Req() request: AuthenticatedRequest): Promise<WalletResponseDto> {
    const wallet = await this.getMyWalletUseCase.execute(request.user?.sub ?? "");
    return WalletResponseDto.fromDomain(wallet);
  }
}

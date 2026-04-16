import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CreateMyWalletUseCase } from "@wallets/application/use-cases/create-my-wallet.use-case";
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
  constructor(
    private readonly createMyWalletUseCase: CreateMyWalletUseCase,
    private readonly getMyWalletUseCase: GetMyWalletUseCase,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Wallets service health check" })
  @ApiOkResponse({ type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "wallets" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(KeycloakJwtAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Create a wallet for the authenticated player" })
  @ApiCreatedResponse({ type: WalletResponseDto })
  @ApiConflictResponse({ description: "Wallet for the authenticated player already exists" })
  @ApiUnauthorizedResponse({ description: "Bearer token is missing or invalid" })
  @ApiInternalServerErrorResponse({
    description: "Authenticated player id is missing or wallet creation failed",
  })
  async create(@Req() request: AuthenticatedRequest): Promise<WalletResponseDto> {
    const wallet = await this.createMyWalletUseCase.execute(request.user?.sub ?? "");
    return WalletResponseDto.fromDomain(wallet);
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

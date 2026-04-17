import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { GameCommandService } from "@games/application/game-command.service";
import { GameQueryService } from "@games/application/game-query.service";
import type {
  CurrentGameSnapshotView,
  GameBetView,
  GameCashOutResponseView,
  GameRoundHistoryEntryView,
} from "@games/application/game-view.types";
import { KeycloakJwtAuthGuard } from "../auth/keycloak-jwt-auth.guard";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";
import { PlaceBetRequestDto } from "../dtos/place-bet-request.dto";

type AuthenticatedRequest = {
  user?: {
    sub?: string;
    preferred_username?: string;
    name?: string;
    email?: string;
  };
};

@ApiTags("games")
@Controller()
export class GamesController {
  constructor(
    private readonly gameQueryService: GameQueryService,
    private readonly gameCommandService: GameCommandService,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Games service health check" })
  @ApiOkResponse({ type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "games" };
  }

  @Get("rounds/current")
  @ApiOperation({ summary: "Get the authoritative current game snapshot" })
  @ApiOkResponse({ description: "Current round snapshot with public bets" })
  async getCurrentRound(): Promise<CurrentGameSnapshotView> {
    return this.gameQueryService.getCurrentSnapshot();
  }

  @Get("rounds/history")
  @ApiOperation({ summary: "Get recent settled rounds" })
  @ApiOkResponse({ description: "Recent round history entries" })
  async getRoundHistory(): Promise<GameRoundHistoryEntryView[]> {
    return this.gameQueryService.getRoundHistory();
  }

  @Get("rounds/:roundId/verification")
  @ApiOperation({ summary: "Get provably-fair verification details for a round" })
  @ApiOkResponse({ description: "Round verification payload" })
  @ApiNotFoundResponse({ description: "Round or strategy was not found" })
  async getRoundVerification(@Param("roundId") roundId: string) {
    return this.gameQueryService.getRoundVerification(roundId);
  }

  @Get("bets/me")
  @UseGuards(KeycloakJwtAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get the authenticated player's bets" })
  @ApiOkResponse({ description: "Authenticated player's bets" })
  @ApiUnauthorizedResponse({ description: "Bearer token is missing or invalid" })
  async getMyBets(@Req() request: AuthenticatedRequest): Promise<GameBetView[]> {
    return this.gameQueryService.getMyBets(request.user?.sub ?? "");
  }

  @Post("bets")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(KeycloakJwtAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Place a bet for the current round" })
  @ApiBody({ type: PlaceBetRequestDto })
  @ApiOkResponse({ description: "Pending bet accepted for asynchronous debit confirmation" })
  @ApiConflictResponse({ description: "Betting is closed or the player already has a bet" })
  @ApiUnauthorizedResponse({ description: "Bearer token is missing or invalid" })
  @ApiInternalServerErrorResponse({ description: "Authenticated player data is missing" })
  async placeBet(
    @Req() request: AuthenticatedRequest,
    @Body() body: PlaceBetRequestDto,
  ): Promise<GameBetView> {
    return this.gameCommandService.placeBet({
      playerId: request.user?.sub ?? "",
      playerUsername: resolvePlayerUsername(request),
      amount: body.amount,
    });
  }

  @Post("bets/cashout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(KeycloakJwtAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Cash out the authenticated player's current bet" })
  @ApiOkResponse({ description: "Locked-in multiplier and payout amount" })
  @ApiConflictResponse({ description: "Cashout is not currently available" })
  @ApiNotFoundResponse({ description: "No current-round bet exists for the player" })
  @ApiUnauthorizedResponse({ description: "Bearer token is missing or invalid" })
  async cashOut(
    @Req() request: AuthenticatedRequest,
  ): Promise<GameCashOutResponseView> {
    return this.gameCommandService.cashOut({
      playerId: request.user?.sub ?? "",
    });
  }
}

function resolvePlayerUsername(request: AuthenticatedRequest): string {
  const rawValue =
    request.user?.preferred_username ??
    request.user?.name ??
    request.user?.email ??
    request.user?.sub ??
    "";

  return rawValue.trim();
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  user?: JWTPayload;
};

@Injectable()
export class KeycloakJwtAuthGuard implements CanActivate {
  private readonly issuer =
    process.env.KEYCLOAK_ISSUER ?? "http://localhost:8080/realms/crash-game";
  private readonly jwksUri =
    process.env.KEYCLOAK_JWKS_URI ??
    `${this.issuer}/protocol/openid-connect/certs`;
  private readonly clientId =
    process.env.KEYCLOAK_CLIENT_ID ?? "crash-game-client";
  private readonly jwks = createRemoteJWKSet(new URL(this.jwksUri));

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Bearer token is required");
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
      });

      if (payload.azp !== this.clientId && payload.client_id !== this.clientId) {
        throw new UnauthorizedException("Token client is not allowed");
      }

      request.user = payload;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Invalid access token");
    }
  }

  private extractBearerToken(authorizationHeader?: string): string | undefined {
    const [scheme, token] = authorizationHeader?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
      return undefined;
    }

    return token;
  }
}

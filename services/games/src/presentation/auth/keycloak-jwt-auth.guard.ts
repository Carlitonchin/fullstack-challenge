import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { JWTPayload } from "jose";
import { KeycloakJwtVerifier } from "./keycloak-jwt.verifier";

type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  user?: JWTPayload;
};

@Injectable()
export class KeycloakJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtVerifier: KeycloakJwtVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Bearer token is required");
    }

    request.user = await this.jwtVerifier.verifyAccessToken(token);
    return true;
  }

  private extractBearerToken(authorizationHeader?: string): string | undefined {
    const [scheme, token] = authorizationHeader?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
      return undefined;
    }

    return token;
  }
}

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

@Injectable()
export class KeycloakJwtVerifier {
  private readonly issuer =
    process.env.KEYCLOAK_ISSUER ?? "http://localhost:8080/realms/crash-game";
  private readonly jwksUri =
    process.env.KEYCLOAK_JWKS_URI ??
    `${this.issuer}/protocol/openid-connect/certs`;
  private readonly clientId =
    process.env.KEYCLOAK_CLIENT_ID ?? "crash-game-client";
  private readonly jwks = createRemoteJWKSet(new URL(this.jwksUri));

  async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
      });

      if (payload.azp !== this.clientId && payload.client_id !== this.clientId) {
        throw new UnauthorizedException("Token client is not allowed");
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Invalid access token");
    }
  }
}

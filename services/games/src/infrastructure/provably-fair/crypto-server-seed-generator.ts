import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { ServerSeedGenerator } from "@games/domain/provably-fair/server-seed-generator";

@Injectable()
export class CryptoServerSeedGenerator implements ServerSeedGenerator {
  generate(): string {
    return randomBytes(32).toString("hex");
  }
}

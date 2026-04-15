import { createHash, createHmac } from "node:crypto";
import type { ProvablyFairStrategy } from "./provably-fair.strategy";
import type {
  ProvablyFairCommitment,
  ProvablyFairInputs,
  ProvablyFairOutcome,
} from "./provably-fair.types";

export class CasinoCrashProvablyFairStrategy implements ProvablyFairStrategy {
  private static readonly ALGORITHM = "crash-hmac-sha256-v1";
  private static readonly HOUSE_EDGE_MODULUS = 101n;
  private static readonly MAX_HASH_WINDOW = 2n ** 52n;
  private static readonly HASH_WINDOW_HEX_LENGTH = 13;

  commit(serverSeed: string): ProvablyFairCommitment {
    return {
      algorithm: CasinoCrashProvablyFairStrategy.ALGORITHM,
      serverSeedHash: this.sha256(serverSeed),
    };
  }

  generate(inputs: ProvablyFairInputs): ProvablyFairOutcome {
    const digest = this.roundDigest(inputs);

    if (this.isInstantBust(digest)) {
      return {
        algorithm: CasinoCrashProvablyFairStrategy.ALGORITHM,
        serverSeedHash: this.sha256(inputs.serverSeed),
        crashPoint: 1,
      };
    }

    const hashWindow = BigInt(
      `0x${digest.slice(0, CasinoCrashProvablyFairStrategy.HASH_WINDOW_HEX_LENGTH)}`,
    );
    const scaledMultiplier =
      (100n * CasinoCrashProvablyFairStrategy.MAX_HASH_WINDOW - hashWindow) /
      (CasinoCrashProvablyFairStrategy.MAX_HASH_WINDOW - hashWindow);

    return {
      algorithm: CasinoCrashProvablyFairStrategy.ALGORITHM,
      serverSeedHash: this.sha256(inputs.serverSeed),
      crashPoint: Number(scaledMultiplier) / 100,
    };
  }

  verify(inputs: ProvablyFairInputs, expectedCrashPoint: number): boolean {
    return this.generate(inputs).crashPoint === expectedCrashPoint;
  }

  private roundDigest(inputs: ProvablyFairInputs): string {
    return createHmac("sha256", inputs.serverSeed)
      .update(inputs.nonce)
      .digest("hex");
  }

  private isInstantBust(digest: string): boolean {
    return BigInt(`0x${digest}`) % CasinoCrashProvablyFairStrategy.HOUSE_EDGE_MODULUS === 0n;
  }

  private sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}

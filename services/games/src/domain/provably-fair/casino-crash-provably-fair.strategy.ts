import { createHash, createHmac } from "node:crypto";
import { ProvablyFairStrategyDefinition } from "./provably-fair-strategy-definition";
import type { ProvablyFairStrategy } from "./provably-fair.strategy";
import type {
  ProvablyFairCommitment,
  ProvablyFairInputs,
  ProvablyFairOutcome,
} from "./provably-fair.types";

export class CasinoCrashProvablyFairStrategy implements ProvablyFairStrategy {
  static readonly STRATEGY_ID = "casino-crash-v1";
  private static readonly ALGORITHM = "crash-hmac-sha256-v1";
  private static readonly HOUSE_EDGE_MODULUS = 101n;
  private static readonly MAX_HASH_WINDOW = 2n ** 52n;
  private static readonly HASH_WINDOW_HEX_LENGTH = 13;
  readonly definition: ProvablyFairStrategyDefinition;

  constructor() {
    const definitionResult = ProvablyFairStrategyDefinition.create({
      id: CasinoCrashProvablyFairStrategy.STRATEGY_ID,
      algorithm: CasinoCrashProvablyFairStrategy.ALGORITHM,
      displayName: "Casino Crash HMAC-SHA256",
      description:
        "Crash-point generation based on a precommitted server seed, an HMAC-SHA256 digest, and an explicit instant-bust house edge rule.",
      hashAlgorithm: "SHA-256(serverSeed)",
      outcomeAlgorithm: "HMAC-SHA256(serverSeed, nonce)",
      houseEdgeDescription:
        "If the full HMAC digest interpreted as a hexadecimal integer is divisible by 101, the crash point is 1.00.",
      verificationFormula:
        "Otherwise take the first 13 hex characters of the HMAC digest as h and compute floor((100 * 2^52 - h) / (2^52 - h)) / 100.",
      verificationSteps: [
        {
          order: 1,
          instruction:
            "Compute SHA-256(serverSeed) and verify it matches the published serverSeedHash.",
        },
        {
          order: 2,
          instruction:
            "Compute HMAC-SHA256 using serverSeed as the key and nonce as the message.",
        },
        {
          order: 3,
          instruction:
            "If the full HMAC digest interpreted as hexadecimal is divisible by 101, the result is 1.00.",
        },
        {
          order: 4,
          instruction:
            "Otherwise take the first 13 hex characters of the digest, convert them to h, and apply the published crash formula.",
        },
      ],
    });

    if (!definitionResult.success) {
      throw definitionResult.error;
    }

    this.definition = definitionResult.data!;
  }

  commit(serverSeed: string): ProvablyFairCommitment {
    return {
      strategyId: this.definition.id,
      serverSeedHash: this.sha256(serverSeed),
    };
  }

  generate(inputs: ProvablyFairInputs): ProvablyFairOutcome {
    const digest = this.roundDigest(inputs);

    if (this.isInstantBust(digest)) {
      return {
        strategyId: this.definition.id,
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
      strategyId: this.definition.id,
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

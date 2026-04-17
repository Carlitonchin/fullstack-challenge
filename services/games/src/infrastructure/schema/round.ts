import { defineEntity, type InferEntity, p } from "@mikro-orm/core";
import { BaseVersionedAggregateSchema } from "@crash/persistence";
import { ProvablyFairStrategyDefinitionSchema } from "./provably-fair-strategy-definition";
import { BetSchema } from "./bet";

export enum RoundStatusType {
  BETTING_OPEN = "BETTING_OPEN",
  BETTING_CLOSED = "BETTING_CLOSED",
  IN_PROGRESS = "IN_PROGRESS",
  CRASHED = "CRASHED",
  ERROR = "ERROR",
  SETTLED = "SETTLED",
}

export const RoundSchema = defineEntity({
  name: "Round",
  tableName: "rounds",
  extends: BaseVersionedAggregateSchema,
  indexes: [
    {
      name: "rounds_status_created_at_index",
      properties: ["status", "createdAt"],
    },
    {
      name: "rounds_provably_fair_strategy_id_created_at_index",
      properties: ["provablyFairStrategy", "createdAt"],
    },
  ],
  properties: {
    id: p.text().primary(),
    status: p.enum(() => RoundStatusType).nativeEnumName("round_status_type"),
    crashPoint: p
      .decimal("number")
      .fieldName("crash_point")
      .precision(12)
      .scale(4)
      .check("crash_point > 1"),
    provablyFairStrategy: () =>
      p
        .manyToOne(ProvablyFairStrategyDefinitionSchema)
        .joinColumn("provably_fair_strategy_id")
        .referenceColumnName("id")
        .deleteRule("restrict")
        .updateRule("restrict"),
    nonce: p.text().check("length(trim(nonce)) > 0"),
    serverSeedHash: p
      .text()
      .fieldName("server_seed_hash")
      .check("length(trim(server_seed_hash)) > 0"),
    serverSeed: p
      .text()
      .fieldName("server_seed")
      .check("length(trim(server_seed)) > 0"),
    startedAt: p
      .datetime()
      .fieldName("started_at")
      .columnType("timestamptz")
      .nullable(),
    bettingClosesAt: p
      .datetime()
      .fieldName("betting_closes_at")
      .columnType("timestamptz"),
    crashedAt: p
      .datetime()
      .fieldName("crashed_at")
      .columnType("timestamptz")
      .nullable(),
    crashMultiplier: p
      .decimal("number")
      .fieldName("crash_multiplier")
      .precision(12)
      .scale(4)
      .nullable(),
    failedAt: p
      .datetime()
      .fieldName("failed_at")
      .columnType("timestamptz")
      .nullable(),
    errorReason: p.text().fieldName("error_reason").nullable(),
    refundRequired: p
      .boolean()
      .fieldName("refund_required")
      .default(false),
    bets: () => p.oneToMany(BetSchema).mappedBy("round"),
  },
});

export type IRound = InferEntity<typeof RoundSchema>;

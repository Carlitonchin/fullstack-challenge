import { defineEntity, type InferEntity, p } from "@mikro-orm/core";
import { BaseVersionedAggregateSchema } from "@crash/persistence";
import { RoundSchema } from "./round";

export enum BetStatusType {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  CASHED_OUT = "CASHED_OUT",
  LOST = "LOST",
  SETTLED = "SETTLED",
  REJECTED = "REJECTED",
}

export const BetSchema = defineEntity({
  name: "Bet",
  tableName: "bets",
  extends: BaseVersionedAggregateSchema,
  indexes: [
    {
      name: "bets_round_id_created_at_index",
      properties: ["round", "createdAt"],
    },
    {
      name: "bets_player_id_created_at_index",
      properties: ["playerId", "createdAt"],
    },
    {
      name: "bets_status_created_at_index",
      properties: ["status", "createdAt"],
    },
  ],
  properties: {
    id: p.text().primary(),
    round: () =>
      p
        .manyToOne(RoundSchema)
        .joinColumn("round_id")
        .referenceColumnName("id")
        .deleteRule("restrict")
        .updateRule("restrict"),
    playerId: p
      .text()
      .fieldName("player_id")
      .check("length(trim(player_id)) > 0"),
    amountInCents: p.bigint().fieldName("amount_in_cents"),
    currency: p.text().check("length(trim(currency)) > 0"),
    status: p.enum(() => BetStatusType).nativeEnumName("bet_status_type"),
    placedAt: p
      .datetime()
      .fieldName("placed_at")
      .columnType("timestamptz"),
    acceptedAt: p
      .datetime()
      .fieldName("accepted_at")
      .columnType("timestamptz")
      .nullable(),
    rejectedAt: p
      .datetime()
      .fieldName("rejected_at")
      .columnType("timestamptz")
      .nullable(),
    rejectionReason: p
      .text()
      .fieldName("rejection_reason")
      .nullable()
      .check("rejection_reason is null or length(trim(rejection_reason)) > 0"),
    cashedOutAt: p
      .datetime()
      .fieldName("cashed_out_at")
      .columnType("timestamptz")
      .nullable(),
    cashoutMultiplier: p
      .decimal("number")
      .fieldName("cashout_multiplier")
      .precision(12)
      .scale(4)
      .nullable(),
    payoutAmountInCents: p.bigint().fieldName("payout_amount_in_cents").nullable(),
    lostAt: p
      .datetime()
      .fieldName("lost_at")
      .columnType("timestamptz")
      .nullable(),
    settledAt: p
      .datetime()
      .fieldName("settled_at")
      .columnType("timestamptz")
      .nullable(),
  },
});

export type IBet = InferEntity<typeof BetSchema>;

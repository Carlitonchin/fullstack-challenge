import { defineEntity, type InferEntity } from "@mikro-orm/core";
import {
  BaseOutboxMessageSchema,
  createOutboxIndexes,
  createOutboxStatusProperty,
  createOutboxUniques,
} from "@crash/persistence";

export const WalletOutboxMessageSchema = defineEntity(
  {
    name: "WalletOutboxMessage",
    tableName: "wallet_outbox_messages",
    extends: BaseOutboxMessageSchema,
    indexes: createOutboxIndexes("wallet_outbox_messages"),
    uniques: createOutboxUniques("wallet_outbox_messages"),
    properties: {
      status: createOutboxStatusProperty("wallet_outbox_status"),
    },
  } as any,
);

export type IWalletOutboxMessage = InferEntity<typeof WalletOutboxMessageSchema>;

function cloneNullableDate(value?: Date | null): Date | null {
  return value ? new Date(value) : null;
}

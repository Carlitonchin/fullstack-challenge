import { defineEntity, type InferEntity, p } from "@mikro-orm/core";
import { BaseCreatedAtSchema } from "@crash/persistence";
import { WalletSchema } from "./wallet";

export enum WalletOperationType {
    ACCOUNT_FUNDING = 'ACCOUNT_FUNDING',
    BET_STAKE_LOCK = 'BET_STAKE_LOCK',
    BET_STAKE_REFUND = 'BET_STAKE_REFUND',
    BET_PAYOUT = 'BET_PAYOUT',
  }

export const WalletOperationSchema = defineEntity({
  name: "WalletOperation",
  tableName: "wallet_operations",
  extends: BaseCreatedAtSchema,
  indexes: [
    {
      name: "wallet_operations_wallet_id_ledger_sequence_index",
      properties: ["wallet", "ledgerSequence"],
    },
    {
      name: "wallet_operations_wallet_id_created_at_index",
      properties: ["wallet", "createdAt"],
    },
  ],
  properties: {
    id: p.text().primary(),
    wallet: () =>
      p
        .manyToOne(WalletSchema)
        .joinColumn("wallet_id")
        .referenceColumnName("id")
        .deleteRule("restrict")
        .updateRule("restrict"),
    amountCents: p.bigint().fieldName("amount_cents").check("amount_cents <> 0"),
    operationId: p
      .text()
      .fieldName("operation_id")
      .unique("wallet_operations_operation_id_unique"),
    operationType: p
      .enum(() => WalletOperationType).nativeEnumName("operation_type"),
    ledgerSequence: p
      .bigint()
      .fieldName("ledger_sequence")
      .generated("identity")
      .unique("wallet_operations_ledger_sequence_unique")
      .check("ledger_sequence > 0"),
  },
});

export type IWalletOperation = InferEntity<typeof WalletOperationSchema>;

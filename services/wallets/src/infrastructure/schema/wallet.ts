import { defineEntity, type InferEntity, p } from "@mikro-orm/core";
import { WalletOperationSchema } from "./wallet-operation";

export enum WalletCurrencyType {
    BRL = "BRL"
}

export const WalletSchema = defineEntity({
    name: "WalletSchema",
    tableName: "wallets",
    properties: {
        id: p.text().primary(),
        playerId: p.text().fieldName("player_id").unique("wallets_player_id_unique"),
        currency: p.enum(() => WalletCurrencyType).nativeEnumName("wallet_currency_type"),
        createdAt: p
            .datetime()
            .fieldName("created_at")
            .columnType("timestamptz")
            .onCreate(() => new Date()),
        operations: () =>
            p
                .oneToMany(WalletOperationSchema)
                .mappedBy("wallet")
                .orderBy({ ledgerSequence: "asc" }),
    },
});

export type IWallet = InferEntity<typeof WalletSchema>;

import type { WalletCurrency } from "./wallet-balance";

type WalletDomainEventProps<TType extends string> = {
  type: TType;
  walletId: string;
  playerId: string;
  occurredAt: Date;
  idempotencyKey: string;
  operationId?: string;
  amountInCents: bigint;
  currency: WalletCurrency;
  balanceAfterInCents: bigint;
};

export abstract class WalletDomainEvent<TType extends string = string> {
  readonly type: TType;
  readonly walletId: string;
  readonly playerId: string;
  readonly occurredAt: Date;
  readonly idempotencyKey: string;
  readonly operationId?: string;
  readonly amountInCents: bigint;
  readonly currency: WalletCurrency;
  readonly balanceAfterInCents: bigint;

  protected constructor(props: WalletDomainEventProps<TType>) {
    this.type = props.type;
    this.walletId = props.walletId;
    this.playerId = props.playerId;
    this.occurredAt = new Date(props.occurredAt);
    this.idempotencyKey = props.idempotencyKey;
    this.operationId = props.operationId;
    this.amountInCents = props.amountInCents;
    this.currency = props.currency;
    this.balanceAfterInCents = props.balanceAfterInCents;
  }

  abstract serialize(): Record<string, unknown>;

  protected serializeBaseData(): Record<string, unknown> {
    return {
      walletId: this.walletId,
      playerId: this.playerId,
      operationId: this.operationId ?? null,
      amountInCents: this.amountInCents.toString(),
      currency: this.currency,
      balanceAfterInCents: this.balanceAfterInCents.toString(),
    };
  }
}

export class WalletCreatedDomainEvent extends WalletDomainEvent<"wallet.created"> {
  constructor(props: Omit<WalletDomainEventProps<"wallet.created">, "operationId">) {
    super(props);
  }

  override serialize(): Record<string, unknown> {
    return this.serializeBaseData();
  }
}

export class WalletCreditedDomainEvent extends WalletDomainEvent<"wallet.credited"> {
  constructor(props: WalletDomainEventProps<"wallet.credited">) {
    super(props);
  }

  override serialize(): Record<string, unknown> {
    return this.serializeBaseData();
  }
}

export class WalletDebitedDomainEvent extends WalletDomainEvent<"wallet.debited"> {
  constructor(props: WalletDomainEventProps<"wallet.debited">) {
    super(props);
  }

  override serialize(): Record<string, unknown> {
    return this.serializeBaseData();
  }
}

import { UniqueConstraintViolationException } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/postgresql";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  OUTBOX_REPOSITORY,
  type BetDebitRequestedData,
  type BetRefundRequestedData,
  type BrokerEnvelope,
  type CashoutCreditRequestedData,
  type OutboxRepository,
} from "@crash/messaging";
import { WalletDomainEventOutboxMapper } from "@wallets/application/outbox/wallet-domain-event-outbox.mapper";
import { WalletBalance } from "@wallets/domain/wallet/wallet-balance";
import { Wallet } from "@wallets/domain/wallet/wallet";
import type { WalletDomainEvent } from "@wallets/domain/wallet/wallet.events";
import { WALLET_REPOSITORY, type IWalletRepository } from "@wallets/port/wallet.repository";

@Injectable()
export class WalletMoneyFlowService {
  private readonly logger = new Logger(WalletMoneyFlowService.name);

  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository,
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,
    private readonly walletDomainEventOutboxMapper: WalletDomainEventOutboxMapper,
    private readonly em: EntityManager,
  ) {}

  async handleBetDebitRequested(
    envelope: BrokerEnvelope<BetDebitRequestedData>,
  ): Promise<void> {
    const idempotencyKey = envelope.data.idempotencyKey;

    if (await this.walletRepository.hasOperation(idempotencyKey)) {
      return;
    }

    const walletResult = await this.walletRepository.findByPlayerId(
      envelope.data.playerId,
    );

    if (!walletResult.success) {
      throw new Error(walletResult.error.message);
    }

    const wallet = walletResult.data;

    if (!wallet) {
      await this.enqueueBetDebitFailed({
        envelope,
        reason: "WALLET_NOT_FOUND",
      });
      await this.flushOrReset();
      return;
    }

    const amountResult = WalletBalance.create({
      amountInCents: BigInt(envelope.data.amountInCents),
      currency: envelope.data.currency,
    });

    if (!amountResult.success) {
      await this.enqueueBetDebitFailed({
        envelope,
        reason: amountResult.error.name,
      });
      await this.flushOrReset();
      return;
    }

    const debitResult = wallet.debit({
      operationId: idempotencyKey,
      amount: amountResult.data!,
      operationType: "BET_STAKE_LOCK",
      occurredAt: new Date(envelope.occurredAt),
    });

    if (!debitResult.success) {
      await this.enqueueBetDebitFailed({
        envelope,
        reason:
          debitResult.error.name === "INSUFFICIENT_WALLET_BALANCE"
            ? "INSUFFICIENT_BALANCE"
            : debitResult.error.name,
      });
      await this.flushOrReset();
      return;
    }

    await this.persistWalletMutation({
      wallet,
      occurredAt: new Date(envelope.occurredAt),
      successMessage: async () => {
        await this.outboxRepository.insert(
          this.walletDomainEventOutboxMapper.mapBetDebitSucceeded({
            outboxId: crypto.randomUUID(),
            persistedAt: new Date(envelope.occurredAt),
            correlationId: envelope.metadata.correlationId,
            causationId: envelope.eventType,
            data: {
              playerId: envelope.data.playerId,
              roundId: envelope.data.roundId,
              betId: envelope.data.betId,
              operationId: idempotencyKey,
              amountInCents: envelope.data.amountInCents,
              currency: envelope.data.currency,
              idempotencyKey,
            },
          }),
        );
      },
    });
  }

  async handleBetRefundRequested(
    envelope: BrokerEnvelope<BetRefundRequestedData>,
  ): Promise<void> {
    const idempotencyKey = envelope.data.idempotencyKey;

    if (await this.walletRepository.hasOperation(idempotencyKey)) {
      return;
    }

    const walletResult = await this.walletRepository.findByPlayerId(
      envelope.data.playerId,
    );

    if (!walletResult.success) {
      throw new Error(walletResult.error.message);
    }

    const wallet = walletResult.data;

    if (!wallet) {
      await this.outboxRepository.insert(
        this.walletDomainEventOutboxMapper.mapBetRefundFailed({
          outboxId: crypto.randomUUID(),
          persistedAt: new Date(envelope.occurredAt),
          correlationId: envelope.metadata.correlationId,
          causationId: envelope.eventType,
          data: {
            playerId: envelope.data.playerId,
            roundId: envelope.data.roundId,
            betId: envelope.data.betId,
            reason: "WALLET_NOT_FOUND",
            idempotencyKey,
          },
        }),
      );
      await this.flushOrReset();
      return;
    }

    const amountResult = WalletBalance.create({
      amountInCents: BigInt(envelope.data.amountInCents),
      currency: envelope.data.currency,
    });

    if (!amountResult.success) {
      await this.outboxRepository.insert(
        this.walletDomainEventOutboxMapper.mapBetRefundFailed({
          outboxId: crypto.randomUUID(),
          persistedAt: new Date(envelope.occurredAt),
          correlationId: envelope.metadata.correlationId,
          causationId: envelope.eventType,
          data: {
            playerId: envelope.data.playerId,
            roundId: envelope.data.roundId,
            betId: envelope.data.betId,
            reason: amountResult.error.name,
            idempotencyKey,
          },
        }),
      );
      await this.flushOrReset();
      return;
    }

    const creditResult = wallet.credit({
      operationId: idempotencyKey,
      amount: amountResult.data!,
      operationType: "BET_STAKE_REFUND",
      occurredAt: new Date(envelope.occurredAt),
    });

    if (!creditResult.success) {
      await this.outboxRepository.insert(
        this.walletDomainEventOutboxMapper.mapBetRefundFailed({
          outboxId: crypto.randomUUID(),
          persistedAt: new Date(envelope.occurredAt),
          correlationId: envelope.metadata.correlationId,
          causationId: envelope.eventType,
          data: {
            playerId: envelope.data.playerId,
            roundId: envelope.data.roundId,
            betId: envelope.data.betId,
            reason: creditResult.error.name,
            idempotencyKey,
          },
        }),
      );
      await this.flushOrReset();
      return;
    }

    await this.persistWalletMutation({
      wallet,
      occurredAt: new Date(envelope.occurredAt),
      successMessage: async () => {
        await this.outboxRepository.insert(
          this.walletDomainEventOutboxMapper.mapBetRefundSucceeded({
            outboxId: crypto.randomUUID(),
            persistedAt: new Date(envelope.occurredAt),
            correlationId: envelope.metadata.correlationId,
            causationId: envelope.eventType,
            data: {
              playerId: envelope.data.playerId,
              roundId: envelope.data.roundId,
              betId: envelope.data.betId,
              operationId: idempotencyKey,
              amountInCents: envelope.data.amountInCents,
              currency: envelope.data.currency,
              idempotencyKey,
            },
          }),
        );
      },
    });
  }

  async handleCashoutCreditRequested(
    envelope: BrokerEnvelope<CashoutCreditRequestedData>,
  ): Promise<void> {
    const idempotencyKey = envelope.data.idempotencyKey;

    if (await this.walletRepository.hasOperation(idempotencyKey)) {
      return;
    }

    const walletResult = await this.walletRepository.findByPlayerId(
      envelope.data.playerId,
    );

    if (!walletResult.success) {
      throw new Error(walletResult.error.message);
    }

    const wallet = walletResult.data;

    if (!wallet) {
      await this.outboxRepository.insert(
        this.walletDomainEventOutboxMapper.mapCashoutCreditFailed({
          outboxId: crypto.randomUUID(),
          persistedAt: new Date(envelope.occurredAt),
          correlationId: envelope.metadata.correlationId,
          causationId: envelope.eventType,
          data: {
            playerId: envelope.data.playerId,
            roundId: envelope.data.roundId,
            betId: envelope.data.betId,
            reason: "WALLET_NOT_FOUND",
            idempotencyKey,
          },
        }),
      );
      await this.flushOrReset();
      return;
    }

    const amountResult = WalletBalance.create({
      amountInCents: BigInt(envelope.data.payoutAmountInCents),
      currency: envelope.data.currency,
    });

    if (!amountResult.success) {
      await this.outboxRepository.insert(
        this.walletDomainEventOutboxMapper.mapCashoutCreditFailed({
          outboxId: crypto.randomUUID(),
          persistedAt: new Date(envelope.occurredAt),
          correlationId: envelope.metadata.correlationId,
          causationId: envelope.eventType,
          data: {
            playerId: envelope.data.playerId,
            roundId: envelope.data.roundId,
            betId: envelope.data.betId,
            reason: amountResult.error.name,
            idempotencyKey,
          },
        }),
      );
      await this.flushOrReset();
      return;
    }

    const creditResult = wallet.credit({
      operationId: idempotencyKey,
      amount: amountResult.data!,
      operationType: "BET_PAYOUT",
      occurredAt: new Date(envelope.occurredAt),
    });

    if (!creditResult.success) {
      await this.outboxRepository.insert(
        this.walletDomainEventOutboxMapper.mapCashoutCreditFailed({
          outboxId: crypto.randomUUID(),
          persistedAt: new Date(envelope.occurredAt),
          correlationId: envelope.metadata.correlationId,
          causationId: envelope.eventType,
          data: {
            playerId: envelope.data.playerId,
            roundId: envelope.data.roundId,
            betId: envelope.data.betId,
            reason: creditResult.error.name,
            idempotencyKey,
          },
        }),
      );
      await this.flushOrReset();
      return;
    }

    await this.persistWalletMutation({
      wallet,
      occurredAt: new Date(envelope.occurredAt),
      successMessage: async () => {
        await this.outboxRepository.insert(
          this.walletDomainEventOutboxMapper.mapCashoutCreditSucceeded({
            outboxId: crypto.randomUUID(),
            persistedAt: new Date(envelope.occurredAt),
            correlationId: envelope.metadata.correlationId,
            causationId: envelope.eventType,
            data: {
              playerId: envelope.data.playerId,
              roundId: envelope.data.roundId,
              betId: envelope.data.betId,
              operationId: idempotencyKey,
              payoutAmountInCents: envelope.data.payoutAmountInCents,
              currency: envelope.data.currency,
              idempotencyKey,
            },
          }),
        );
      },
    });
  }

  private async persistWalletMutation(params: {
    wallet: Wallet;
    occurredAt: Date;
    successMessage: () => Promise<void>;
  }): Promise<void> {
    const newOperations = params.wallet.pullNewOperations();
    const walletEvents = params.wallet.pullDomainEvents();

    for (const operation of newOperations) {
      const persistedOperationResult = await this.walletRepository.persistOperation({
        wallet: params.wallet,
        operation,
      });

      if (!persistedOperationResult.success) {
        throw new Error(persistedOperationResult.error.message);
      }
    }

    await this.insertWalletEvents(walletEvents, params.occurredAt);
    await params.successMessage();
    await this.flushOrReset();
  }

  private async insertWalletEvents(
    events: WalletDomainEvent[],
    persistedAt: Date,
  ): Promise<void> {
    for (const event of events) {
      await this.outboxRepository.insert(
        this.walletDomainEventOutboxMapper.map({
          event,
          outboxId: crypto.randomUUID(),
          persistedAt,
        }),
      );
    }
  }

  private async enqueueBetDebitFailed(params: {
    envelope: BrokerEnvelope<BetDebitRequestedData>;
    reason: string;
  }): Promise<void> {
    await this.outboxRepository.insert(
      this.walletDomainEventOutboxMapper.mapBetDebitFailed({
        outboxId: crypto.randomUUID(),
        persistedAt: new Date(params.envelope.occurredAt),
        correlationId: params.envelope.metadata.correlationId,
        causationId: params.envelope.eventType,
        data: {
          playerId: params.envelope.data.playerId,
          roundId: params.envelope.data.roundId,
          betId: params.envelope.data.betId,
          reason: params.reason,
          idempotencyKey: params.envelope.data.idempotencyKey,
        },
      }),
    );
  }

  private async flushOrReset(): Promise<void> {
    try {
      await this.em.flush();
    } catch (error) {
      this.em.clear();

      if (error instanceof UniqueConstraintViolationException) {
        this.logger.warn(`Ignoring duplicate wallet side effect: ${error.message}`);
        return;
      }

      throw error;
    }
  }
}

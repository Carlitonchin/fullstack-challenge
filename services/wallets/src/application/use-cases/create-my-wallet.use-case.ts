import { UniqueConstraintViolationException } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/postgresql";
import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { Wallet } from "@wallets/domain/wallet/wallet";
import { WalletBalance } from "@wallets/domain/wallet/wallet-balance";
import {
  TIME_PROVIDER,
  type ITimeProvider,
} from "@wallets/port/time-provider";
import {
  WALLET_OUTBOX_REPOSITORY,
  type IWalletOutboxRepository,
} from "@wallets/port/wallet-outbox.repository";
import {
  WALLET_REPOSITORY,
  type IWalletRepository,
} from "@wallets/port/wallet.repository";

const INITIAL_BALANCE_IN_CENTS = 10_000n;
const OUTBOX_EXCHANGE_NAME = "wallets.domain";
const AGGREGATE_TYPE = "wallet";

@Injectable()
export class CreateMyWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository,
    @Inject(WALLET_OUTBOX_REPOSITORY)
    private readonly walletOutboxRepository: IWalletOutboxRepository,
    @Inject(TIME_PROVIDER)
    private readonly timeProvider: ITimeProvider,
    private readonly em: EntityManager,
  ) {}

  async execute(playerId: string): Promise<Wallet> {
    const normalizedPlayerId = playerId.trim();

    if (!normalizedPlayerId) {
      throw new InternalServerErrorException("Authenticated player id is missing");
    }

    const existingWalletResult = await this.walletRepository.findByPlayerId(normalizedPlayerId);

    if (!existingWalletResult.success) {
      throw new InternalServerErrorException(existingWalletResult.error.message);
    }

    if (existingWalletResult.data) {
      throw new ConflictException(
        `Wallet for player ${normalizedPlayerId} already exists`,
      );
    }

    const now = this.timeProvider.now();
    const walletResult = Wallet.new({
      id: Bun.randomUUIDv7(),
      playerId: normalizedPlayerId,
      createdAt: now,
    });

    if (!walletResult.success) {
      throw new InternalServerErrorException(walletResult.error.message);
    }

    const wallet = walletResult.data!;
    const initialBalanceResult = WalletBalance.create({
      amountInCents: INITIAL_BALANCE_IN_CENTS,
      currency: "BRL",
    });

    if (!initialBalanceResult.success) {
      throw new InternalServerErrorException(initialBalanceResult.error.message);
    }

    const creditResult = wallet.credit({
      operationId: Bun.randomUUIDv7(),
      amount: initialBalanceResult.data!,
      operationType: "ACCOUNT_FUNDING",
      occurredAt: now,
    });

    if (!creditResult.success) {
      throw new InternalServerErrorException(creditResult.error.message);
    }

    const operations = wallet.pullNewOperations();
    const events = wallet.pullDomainEvents();

    const persistedWalletResult = await this.walletRepository.persist(wallet);

    if (!persistedWalletResult.success) {
      throw new InternalServerErrorException(persistedWalletResult.error.message);
    }

    for (const operation of operations) {
      const persistedOperationResult = await this.walletRepository.persistOperation({
        wallet,
        operation,
      });

      if (!persistedOperationResult.success) {
        throw new InternalServerErrorException(persistedOperationResult.error.message);
      }
    }

    for (const event of events) {
      const outboxId = Bun.randomUUIDv7();

      await this.walletOutboxRepository.insert({
        id: outboxId,
        aggregateType: AGGREGATE_TYPE,
        aggregateId: wallet.id,
        eventType: event.type,
        exchangeName: OUTBOX_EXCHANGE_NAME,
        routingKey: event.type,
        idempotencyKey: event.idempotencyKey,
        payload: {
          eventType: event.type,
          occurredAt: event.occurredAt.toISOString(),
          version: 1,
          aggregate: {
            type: AGGREGATE_TYPE,
            id: wallet.id,
          },
          metadata: {
            idempotencyKey: event.idempotencyKey,
            producer: "wallets",
            aggregateType: AGGREGATE_TYPE,
            aggregateId: wallet.id,
            outboxId,
          },
          data: event.serialize(),
        },
        createdAt: now,
        updatedAt: now,
        availableAt: now,
      });
    }

    try {
      await this.em.flush();
    } catch (error) {
      this.em.clear();

      if (this.isWalletAlreadyExistsError(error)) {
        throw new ConflictException(
          `Wallet for player ${normalizedPlayerId} already exists`,
        );
      }

      throw error;
    }

    return wallet;
  }

  private isWalletAlreadyExistsError(error: unknown): boolean {
    return (
      error instanceof UniqueConstraintViolationException &&
      typeof error.message === "string" &&
      error.message.includes("wallets_player_id_unique")
    );
  }
}

import { UniqueConstraintViolationException } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/postgresql";
import {
  OUTBOX_REPOSITORY,
  type OutboxRepository,
} from "@crash/messaging";
import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { WalletDomainEventOutboxMapper } from "@wallets/application/outbox/wallet-domain-event-outbox.mapper";
import { Wallet } from "@wallets/domain/wallet/wallet";
import { WalletBalance } from "@wallets/domain/wallet/wallet-balance";
import {
  TIME_PROVIDER,
  type ITimeProvider,
} from "@wallets/port/time-provider";
import {
  WALLET_REPOSITORY,
  type IWalletRepository,
} from "@wallets/port/wallet.repository";

const INITIAL_BALANCE_IN_CENTS = 10_000n;

@Injectable()
export class CreateMyWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: IWalletRepository,
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,
    @Inject(TIME_PROVIDER)
    private readonly timeProvider: ITimeProvider,
    private readonly walletDomainEventOutboxMapper: WalletDomainEventOutboxMapper,
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

      await this.outboxRepository.insert(
        this.walletDomainEventOutboxMapper.map({
          event,
          outboxId,
          persistedAt: now,
        }),
      );
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

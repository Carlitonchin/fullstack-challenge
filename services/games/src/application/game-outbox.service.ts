import { Inject, Injectable } from "@nestjs/common";
import {
  OUTBOX_REPOSITORY,
  type BetDebitRequestedData,
  type BetRefundRequestedData,
  type CashoutCreditRequestedData,
  type OutboxRepository,
} from "@crash/messaging";
import { GameDomainEventOutboxMapper } from "@games/application/outbox/game-domain-event-outbox.mapper";
import type { BetDomainEvent } from "@games/domain/bet/bet.events";
import type { RoundDomainEvent } from "@games/domain/round/round.events";

@Injectable()
export class GameOutboxService {
  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,
    private readonly gameDomainEventOutboxMapper: GameDomainEventOutboxMapper,
  ) {}

  async insertRoundEvents(params: {
    events: RoundDomainEvent[];
    persistedAt: Date;
    outboxRepository?: OutboxRepository;
  }): Promise<void> {
    const repository = params.outboxRepository ?? this.outboxRepository;

    for (const event of params.events) {
      await repository.insert(
        this.gameDomainEventOutboxMapper.mapRoundEvent({
          event,
          outboxId: crypto.randomUUID(),
          persistedAt: params.persistedAt,
        }),
      );
    }
  }

  async insertBetEvents(params: {
    events: BetDomainEvent[];
    persistedAt: Date;
    outboxRepository?: OutboxRepository;
  }): Promise<void> {
    const repository = params.outboxRepository ?? this.outboxRepository;

    for (const event of params.events) {
      await repository.insert(
        this.gameDomainEventOutboxMapper.mapBetEvent({
          event,
          outboxId: crypto.randomUUID(),
          persistedAt: params.persistedAt,
        }),
      );
    }
  }

  async insertBetDebitRequested(params: {
    data: BetDebitRequestedData;
    persistedAt: Date;
    correlationId?: string | null;
    causationId?: string | null;
    outboxRepository?: OutboxRepository;
  }): Promise<void> {
    const repository = params.outboxRepository ?? this.outboxRepository;

    await repository.insert(
      this.gameDomainEventOutboxMapper.mapBetDebitRequested({
        data: params.data,
        outboxId: crypto.randomUUID(),
        persistedAt: params.persistedAt,
        correlationId: params.correlationId,
        causationId: params.causationId,
      }),
    );
  }

  async insertBetRefundRequested(params: {
    data: BetRefundRequestedData;
    persistedAt: Date;
    correlationId?: string | null;
    causationId?: string | null;
    outboxRepository?: OutboxRepository;
  }): Promise<void> {
    const repository = params.outboxRepository ?? this.outboxRepository;

    await repository.insert(
      this.gameDomainEventOutboxMapper.mapBetRefundRequested({
        data: params.data,
        outboxId: crypto.randomUUID(),
        persistedAt: params.persistedAt,
        correlationId: params.correlationId,
        causationId: params.causationId,
      }),
    );
  }

  async insertCashoutCreditRequested(params: {
    data: CashoutCreditRequestedData;
    persistedAt: Date;
    correlationId?: string | null;
    causationId?: string | null;
    outboxRepository?: OutboxRepository;
  }): Promise<void> {
    const repository = params.outboxRepository ?? this.outboxRepository;

    await repository.insert(
      this.gameDomainEventOutboxMapper.mapCashoutCreditRequested({
        data: params.data,
        outboxId: crypto.randomUUID(),
        persistedAt: params.persistedAt,
        correlationId: params.correlationId,
        causationId: params.causationId,
      }),
    );
  }
}

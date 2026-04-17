import { EntityManager } from "@mikro-orm/postgresql";
import { DynamicModule, Module, type Provider } from "@nestjs/common";
import { AmqpBrokerPublisher } from "./amqp-broker.publisher";
import { OutboxDispatcherService } from "./outbox-dispatcher.service";
import { OutboxPublisherWorker } from "./outbox-publisher.worker";
import { PostgresOutboxRepository } from "./postgres-outbox.repository";
import { createOutboxRuntimeConfig } from "./runtime-config";
import { SystemClock } from "./system-clock";
import {
  BROKER_PUBLISHER,
  CLOCK,
  OUTBOX_REPOSITORY,
  OUTBOX_RUNTIME_CONFIG,
} from "./tokens";

const OUTBOX_WORKER_ID_PREFIX = Symbol("OUTBOX_WORKER_ID_PREFIX");
const OUTBOX_SCHEMA = Symbol("OUTBOX_SCHEMA");
const OUTBOX_TABLE_NAME = Symbol("OUTBOX_TABLE_NAME");

export type MessagingOutboxModuleOptions = {
  schema: unknown;
  tableName: string;
  workerIdPrefix: string;
  exchangeType?: "topic";
};

@Module({})
export class MessagingOutboxModule {
  static register(options: MessagingOutboxModuleOptions): DynamicModule {
    const runtimeConfig = createOutboxRuntimeConfig({
      exchangeType: options.exchangeType,
    });

    const providers: Provider[] = [
      {
        provide: OUTBOX_RUNTIME_CONFIG,
        useValue: runtimeConfig,
      },
      {
        provide: OUTBOX_WORKER_ID_PREFIX,
        useValue: options.workerIdPrefix,
      },
      {
        provide: OUTBOX_SCHEMA,
        useValue: options.schema,
      },
      {
        provide: OUTBOX_TABLE_NAME,
        useValue: options.tableName,
      },
      {
        provide: CLOCK,
        useClass: SystemClock,
      },
      {
        provide: OUTBOX_REPOSITORY,
        inject: [EntityManager, OUTBOX_SCHEMA, OUTBOX_TABLE_NAME],
        useFactory: (
          em: EntityManager,
          schema: unknown,
          tableName: string,
        ) => new PostgresOutboxRepository(em, { schema, tableName }),
      },
      {
        provide: BROKER_PUBLISHER,
        inject: [OUTBOX_RUNTIME_CONFIG],
        useFactory: (config: ConstructorParameters<typeof AmqpBrokerPublisher>[0]) =>
          new AmqpBrokerPublisher(config),
      },
      OutboxDispatcherService,
      {
        provide: OutboxPublisherWorker,
        inject: [OutboxDispatcherService, OUTBOX_RUNTIME_CONFIG, OUTBOX_WORKER_ID_PREFIX],
        useFactory: (
          dispatcherService: OutboxDispatcherService,
          config: ConstructorParameters<typeof OutboxPublisherWorker>[1],
          workerIdPrefix: string,
        ) => {
          const worker = new OutboxPublisherWorker(dispatcherService, config);
          worker.setWorkerIdPrefix(workerIdPrefix);
          return worker;
        },
      },
    ];

    return {
      module: MessagingOutboxModule,
      providers,
      exports: [
        OUTBOX_REPOSITORY,
        BROKER_PUBLISHER,
        OUTBOX_RUNTIME_CONFIG,
        CLOCK,
        OutboxDispatcherService,
      ],
    };
  }
}

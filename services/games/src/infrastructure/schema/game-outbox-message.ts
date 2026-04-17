import { defineEntity, type InferEntity } from "@mikro-orm/core";
import {
  BaseOutboxMessageSchema,
  createOutboxIndexes,
  createOutboxStatusProperty,
  createOutboxUniques,
} from "@crash/persistence";

export const GameOutboxMessageSchema = defineEntity(
  {
    name: "GameOutboxMessage",
    tableName: "game_outbox_messages",
    extends: BaseOutboxMessageSchema,
    indexes: createOutboxIndexes("game_outbox_messages"),
    uniques: createOutboxUniques("game_outbox_messages"),
    properties: {
      status: createOutboxStatusProperty("game_outbox_status"),
    },
  } as any,
);

export type IGameOutboxMessage = InferEntity<typeof GameOutboxMessageSchema>;

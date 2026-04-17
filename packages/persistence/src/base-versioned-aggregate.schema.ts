import { defineEntity } from "@mikro-orm/core";
import { BaseCreatedAtSchema } from "./base-created-at.schema";
import { versionField } from "./field-builders";

export const BaseVersionedAggregateSchema = defineEntity({
  name: "BaseVersionedAggregate",
  abstract: true,
  extends: BaseCreatedAtSchema,
  properties: {
    version: versionField("version"),
  },
});

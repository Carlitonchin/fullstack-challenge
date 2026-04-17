import { defineEntity } from "@mikro-orm/core";
import { timestampTz } from "./field-builders";

export const BaseCreatedAtSchema = defineEntity({
  name: "BaseCreatedAt",
  abstract: true,
  properties: {
    createdAt: timestampTz("created_at").onCreate(() => new Date()),
  },
});

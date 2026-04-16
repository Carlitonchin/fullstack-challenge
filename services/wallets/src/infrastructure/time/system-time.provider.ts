import { Injectable } from "@nestjs/common";
import type { ITimeProvider } from "@wallets/port/time-provider";

@Injectable()
export class SystemTimeProvider implements ITimeProvider {
  now(): Date {
    return new Date();
  }
}

import { Injectable } from "@nestjs/common";
import type { Clock } from "./types";

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

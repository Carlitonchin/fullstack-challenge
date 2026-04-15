import {
  BettingCannotCloseBeforeRoundCreationError,
  BettingCloseTimeMustBeAfterCreationTimeError,
  BettingWindowMustBeGreaterThanZeroError,
  CrashPointMustBeGreaterThanOneError,
  CrashedOrSettledRoundsMustHaveACrashMultiplierError,
  CrashedOrSettledRoundsMustHaveACrashTimeError,
  ErrorReasonIsRequiredError,
  ErroredRoundsMustHaveAFailureTimeError,
  ErroredRoundsMustHaveAnErrorReasonError,
  ErroredRoundsMustRequireARefundError,
  RoundCanOnlyCloseBettingFromBettingOpenError,
  RoundCanOnlyCrashFromInProgressError,
  RoundCanOnlyFailFromANonTerminalStatusError,
  RoundCanOnlySettleFromCrashedStatusError,
  RoundCanOnlyStartFromBettingClosedError,
  RoundCannotCrashBeforeItStartsError,
  RoundCannotFailBeforeCreationError,
  RoundCannotFailBeforeItCrashesError,
  RoundCannotFailBeforeItStartsError,
  RoundCannotStartBeforeCreationError,
  type RoundDomainError,
  RoundIdIsRequiredError,
  type RoundResult,
  ServerSeedHashIsRequiredError,
  ServerSeedIsRequiredError,
  StartedRoundsMustHaveAStartTimeError,
} from "./round.errors";
import { type RoundDomainEvent } from "./round.events";

export enum RoundStatus {
  BETTING_OPEN = "BETTING_OPEN",
  BETTING_CLOSED = "BETTING_CLOSED",
  IN_PROGRESS = "IN_PROGRESS",
  CRASHED = "CRASHED",
  ERROR = "ERROR",
  SETTLED = "SETTLED",
}

type RoundProps = {
  id: string;
  status: RoundStatus;
  crashPoint: number;
  serverSeedHash: string;
  serverSeed: string;
  startedAt: Date | null;
  bettingClosesAt: Date;
  crashedAt: Date | null;
  crashMultiplier: number | null;
  failedAt: Date | null;
  errorReason: string | null;
  refundRequired: boolean;
  createdAt: Date;
};

type NewRoundProps = {
  id: string;
  crashPoint: number;
  serverSeedHash: string;
  createdAt: Date;
  bettingWindowInSeconds: number;
  serverSeed: string;
};

export class Round {
  private _id: string;
  private _status: RoundStatus;
  private _crashPoint: number;
  private _serverSeedHash: string;
  private _serverSeed: string;
  private _startedAt: Date | null;
  private _bettingClosesAt: Date;
  private _crashedAt: Date | null;
  private _crashMultiplier: number | null;
  private _failedAt: Date | null;
  private _errorReason: string | null;
  private _refundRequired: boolean;
  private _createdAt: Date;
  private _domainEvents: RoundDomainEvent[];

  private constructor(props: RoundProps) {
    this._id = props.id;
    this._status = props.status;
    this._crashPoint = props.crashPoint;
    this._serverSeedHash = props.serverSeedHash;
    this._serverSeed = props.serverSeed;
    this._startedAt = props.startedAt;
    this._bettingClosesAt = props.bettingClosesAt;
    this._crashedAt = props.crashedAt;
    this._crashMultiplier = props.crashMultiplier;
    this._failedAt = props.failedAt;
    this._errorReason = props.errorReason;
    this._refundRequired = props.refundRequired;
    this._createdAt = props.createdAt;
    this._domainEvents = [];
  }

  static new(props: NewRoundProps): RoundResult<Round> {
    if (props.bettingWindowInSeconds <= 0) {
      return Round.failure(new BettingWindowMustBeGreaterThanZeroError());
    }

    const bettingClosesAt = new Date(
      props.createdAt.getTime() + props.bettingWindowInSeconds * 1000,
    );

    const roundProps: RoundProps = {
      id: props.id,
      status: RoundStatus.BETTING_OPEN,
      crashPoint: props.crashPoint,
      serverSeedHash: props.serverSeedHash,
      serverSeed: props.serverSeed,
      startedAt: null,
      bettingClosesAt,
      crashedAt: null,
      crashMultiplier: null,
      failedAt: null,
      errorReason: null,
      refundRequired: false,
      createdAt: props.createdAt,
    };

    const invariantResult = Round.ensureInvariants(roundProps);
    if (!invariantResult.success) {
      return invariantResult;
    }

    const round = new Round(roundProps);

    round.recordDomainEvent({
      type: "round.created",
      roundId: round.id,
      occurredAt: props.createdAt,
      crashPoint: round.crashPoint,
      bettingClosesAt: round.bettingClosesAt,
      serverSeedHash: round.serverSeedHash,
    });

    return Round.success(round);
  }

  static rehydrate(props: RoundProps): RoundResult<Round> {
    const invariantResult = Round.ensureInvariants(props);
    if (!invariantResult.success) {
      return invariantResult;
    }

    return Round.success(new Round(props));
  }

  get id(): string {
    return this._id;
  }

  get status(): RoundStatus {
    return this._status;
  }

  get crashPoint(): number {
    return this._crashPoint;
  }

  get serverSeedHash(): string {
    return this._serverSeedHash;
  }

  get serverSeed(): string {
    return this._serverSeed;
  }

  get startedAt(): Date | null {
    return this._startedAt;
  }

  get bettingClosesAt(): Date {
    return this._bettingClosesAt;
  }

  get crashedAt(): Date | null {
    return this._crashedAt;
  }

  get crashMultiplier(): number | null {
    return this._crashMultiplier;
  }

  get failedAt(): Date | null {
    return this._failedAt;
  }

  get errorReason(): string | null {
    return this._errorReason;
  }

  get refundRequired(): boolean {
    return this._refundRequired;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  pullDomainEvents(): RoundDomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  get isBettingOpen(): boolean {
    return this._status === RoundStatus.BETTING_OPEN;
  }

  get isBettingClosed(): boolean {
    return this._status === RoundStatus.BETTING_CLOSED;
  }

  get isInProgress(): boolean {
    return this._status === RoundStatus.IN_PROGRESS;
  }

  get isCrashed(): boolean {
    return this._status === RoundStatus.CRASHED;
  }

  get isError(): boolean {
    return this._status === RoundStatus.ERROR;
  }

  get isSettled(): boolean {
    return this._status === RoundStatus.SETTLED;
  }

  closeBetting(closedAt: Date = new Date()): RoundResult {
    if (!this.isBettingOpen) {
      return Round.failure(
        new RoundCanOnlyCloseBettingFromBettingOpenError(),
      );
    }

    if (closedAt.getTime() < this.createdAt.getTime()) {
      return Round.failure(new BettingCannotCloseBeforeRoundCreationError());
    }

    this._status = RoundStatus.BETTING_CLOSED;
    this.recordDomainEvent({
      type: "round.betting-closed",
      roundId: this.id,
      occurredAt: closedAt,
    });

    return Round.success();
  }

  start(startedAt: Date = new Date()): RoundResult {
    if (!this.isBettingClosed) {
      return Round.failure(new RoundCanOnlyStartFromBettingClosedError());
    }

    if (startedAt.getTime() < this.createdAt.getTime()) {
      return Round.failure(new RoundCannotStartBeforeCreationError());
    }

    this._status = RoundStatus.IN_PROGRESS;
    this._startedAt = startedAt;
    this.recordDomainEvent({
      type: "round.started",
      roundId: this.id,
      occurredAt: startedAt,
    });

    return Round.success();
  }

  crash(crashedAt: Date = new Date()): RoundResult {
    if (!this.isInProgress) {
      return Round.failure(new RoundCanOnlyCrashFromInProgressError());
    }

    if (this.startedAt && crashedAt.getTime() < this.startedAt.getTime()) {
      return Round.failure(new RoundCannotCrashBeforeItStartsError());
    }

    this._status = RoundStatus.CRASHED;
    this._crashedAt = crashedAt;
    this._crashMultiplier = this._crashPoint;
    this.recordDomainEvent({
      type: "round.crashed",
      roundId: this.id,
      occurredAt: crashedAt,
      crashMultiplier: this._crashPoint,
    });

    return Round.success();
  }

  fail(errorReason: string, failedAt: Date = new Date()): RoundResult {
    if (this.isSettled || this.isError) {
      return Round.failure(
        new RoundCanOnlyFailFromANonTerminalStatusError(),
      );
    }

    if (!errorReason.trim()) {
      return Round.failure(new ErrorReasonIsRequiredError());
    }

    if (failedAt.getTime() < this.createdAt.getTime()) {
      return Round.failure(new RoundCannotFailBeforeCreationError());
    }

    if (this.startedAt && failedAt.getTime() < this.startedAt.getTime()) {
      return Round.failure(new RoundCannotFailBeforeItStartsError());
    }

    if (this.crashedAt && failedAt.getTime() < this.crashedAt.getTime()) {
      return Round.failure(new RoundCannotFailBeforeItCrashesError());
    }

    this._status = RoundStatus.ERROR;
    this._failedAt = failedAt;
    this._errorReason = errorReason;
    this._refundRequired = true;
    this.recordDomainEvent({
      type: "round.failed",
      roundId: this.id,
      occurredAt: failedAt,
      errorReason,
      refundRequired: true,
    });

    return Round.success();
  }

  settle(): RoundResult {
    if (!this.isCrashed) {
      return Round.failure(new RoundCanOnlySettleFromCrashedStatusError());
    }

    this._status = RoundStatus.SETTLED;
    this.recordDomainEvent({
      type: "round.settled",
      roundId: this.id,
      occurredAt: new Date(),
    });

    return Round.success();
  }

  canAcceptBets(at: Date = new Date()): boolean {
    return (
      this.isBettingOpen && at.getTime() <= this.bettingClosesAt.getTime()
    );
  }

  private static ensureInvariants(props: RoundProps): RoundResult {
    if (!props.id.trim()) {
      return Round.failure(new RoundIdIsRequiredError());
    }

    if (!props.serverSeed.trim()) {
      return Round.failure(new ServerSeedIsRequiredError());
    }

    if (!props.serverSeedHash.trim()) {
      return Round.failure(new ServerSeedHashIsRequiredError());
    }

    if (props.crashPoint <= 1) {
      return Round.failure(new CrashPointMustBeGreaterThanOneError());
    }

    if (props.bettingClosesAt.getTime() <= props.createdAt.getTime()) {
      return Round.failure(
        new BettingCloseTimeMustBeAfterCreationTimeError(),
      );
    }

    if (props.status === RoundStatus.IN_PROGRESS && props.startedAt === null) {
      return Round.failure(new StartedRoundsMustHaveAStartTimeError());
    }

    if (
      (props.status === RoundStatus.CRASHED ||
        props.status === RoundStatus.SETTLED) &&
      props.crashedAt === null
    ) {
      return Round.failure(
        new CrashedOrSettledRoundsMustHaveACrashTimeError(),
      );
    }

    if (
      (props.status === RoundStatus.CRASHED ||
        props.status === RoundStatus.SETTLED) &&
      props.crashMultiplier === null
    ) {
      return Round.failure(
        new CrashedOrSettledRoundsMustHaveACrashMultiplierError(),
      );
    }

    if (props.status === RoundStatus.ERROR && props.failedAt === null) {
      return Round.failure(new ErroredRoundsMustHaveAFailureTimeError());
    }

    if (
      props.status === RoundStatus.ERROR &&
      (props.errorReason === null || !props.errorReason.trim())
    ) {
      return Round.failure(
        new ErroredRoundsMustHaveAnErrorReasonError(),
      );
    }

    if (props.status === RoundStatus.ERROR && !props.refundRequired) {
      return Round.failure(new ErroredRoundsMustRequireARefundError());
    }

    return Round.success();
  }

  private recordDomainEvent(event: RoundDomainEvent): void {
    this._domainEvents.push(event);
  }

  private static success<T>(data?: T): RoundResult<T> {
    return {
      success: true,
      data,
    };
  }

  private static failure(error: RoundDomainError): RoundResult {
    return {
      success: false,
      error,
    };
  }
}

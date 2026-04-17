import * as RoundErrors from "./round.errors";
import { type RoundDomainEvent } from "./round.events";
import type { ProvablyFairStrategyDefinition } from "@games/domain/provably-fair/provably-fair-strategy-definition";

export enum RoundStatus {
  BETTING_OPEN = "BETTING_OPEN",
  BETTING_CLOSED = "BETTING_CLOSED",
  IN_PROGRESS = "IN_PROGRESS",
  CRASHED = "CRASHED",
  ERROR = "ERROR",
  SETTLED = "SETTLED",
}

const DEFAULT_PROVABLY_FAIR_STRATEGY_ID = "casino-crash-v1";

export type RoundProvablyFairPublicSnapshot = {
  roundId: string;
  strategyId: string;
  strategyVersion: string;
  strategyDisplayName: string;
  strategyDescription: string;
  algorithm: string;
  hashAlgorithm: string;
  outcomeAlgorithm: string;
  nonce: string;
  serverSeedHash: string;
  serverSeed: string | null;
  isServerSeedRevealed: boolean;
  crashPoint: number;
  crashMultiplier: number | null;
  houseEdgeDescription: string;
  verificationFormula: string;
  verificationSteps: { order: number; instruction: string }[];
};

type RoundProps = {
  id: string;
  version: number;
  status: RoundStatus;
  crashPoint: number;
  provablyFairStrategyId: string;
  nonce: string;
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
  provablyFairStrategyId?: string;
  nonce?: string;
  serverSeedHash: string;
  createdAt: Date;
  bettingWindowInSeconds: number;
  serverSeed: string;
};

export class Round {
  private _id: string;
  private _version: number;
  private _status: RoundStatus;
  private _crashPoint: number;
  private _provablyFairStrategyId: string;
  private _nonce: string;
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
    this._version = props.version;
    this._status = props.status;
    this._crashPoint = props.crashPoint;
    this._provablyFairStrategyId = props.provablyFairStrategyId;
    this._nonce = props.nonce;
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

  static new(props: NewRoundProps): RoundErrors.RoundResult<Round> {
    if (props.bettingWindowInSeconds <= 0) {
      return Round.failure(
        new RoundErrors.BettingWindowMustBeGreaterThanZeroError(),
      );
    }

    const bettingClosesAt = new Date(
      props.createdAt.getTime() + props.bettingWindowInSeconds * 1000,
    );

    const roundProps: RoundProps = {
      id: props.id,
      version: 1,
      status: RoundStatus.BETTING_OPEN,
      crashPoint: props.crashPoint,
      provablyFairStrategyId:
        props.provablyFairStrategyId ?? DEFAULT_PROVABLY_FAIR_STRATEGY_ID,
      nonce: props.nonce ?? props.id,
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
      provablyFairStrategyId: round.provablyFairStrategyId,
      nonce: round.nonce,
      serverSeedHash: round.serverSeedHash,
    });

    return Round.success(round);
  }

  static rehydrate(props: RoundProps): RoundErrors.RoundResult<Round> {
    return Round.success(new Round(props));
  }

  get id(): string {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  get status(): RoundStatus {
    return this._status;
  }

  get crashPoint(): number {
    return this._crashPoint;
  }

  get provablyFairStrategyId(): string {
    return this._provablyFairStrategyId;
  }

  get nonce(): string {
    return this._nonce;
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

  get isActive(): boolean {
    return !this.isSettled && !this.isError;
  }

  get isTerminal(): boolean {
    return !this.isActive;
  }

  get isServerSeedRevealed(): boolean {
    return this.isTerminal;
  }

  projectProvablyFairPublicSnapshot(
    strategyDefinition: ProvablyFairStrategyDefinition,
  ): RoundErrors.RoundResult<RoundProvablyFairPublicSnapshot> {
    if (strategyDefinition.id !== this.provablyFairStrategyId) {
      return Round.failure(
        new RoundErrors.RoundProvablyFairStrategyDefinitionMismatchError(),
      );
    }

    return Round.success({
      roundId: this.id,
      strategyId: strategyDefinition.id,
      strategyVersion: strategyDefinition.version,
      strategyDisplayName: strategyDefinition.displayName,
      strategyDescription: strategyDefinition.description,
      algorithm: strategyDefinition.algorithm,
      hashAlgorithm: strategyDefinition.hashAlgorithm,
      outcomeAlgorithm: strategyDefinition.outcomeAlgorithm,
      nonce: this.nonce,
      serverSeedHash: this.serverSeedHash,
      serverSeed: this.isServerSeedRevealed ? this.serverSeed : null,
      isServerSeedRevealed: this.isServerSeedRevealed,
      crashPoint: this.crashPoint,
      crashMultiplier: this.crashMultiplier,
      houseEdgeDescription: strategyDefinition.houseEdgeDescription,
      verificationFormula: strategyDefinition.verificationFormula,
      verificationSteps: strategyDefinition.verificationSteps,
    });
  }

  closeBetting(closedAt: Date = new Date()): RoundErrors.RoundResult {
    if (!this.isBettingOpen) {
      return Round.failure(
        new RoundErrors.RoundCanOnlyCloseBettingFromBettingOpenError(),
      );
    }

    if (closedAt.getTime() < this.createdAt.getTime()) {
      return Round.failure(
        new RoundErrors.BettingCannotCloseBeforeRoundCreationError(),
      );
    }

    this._status = RoundStatus.BETTING_CLOSED;
    this.recordDomainEvent({
      type: "round.betting-closed",
      roundId: this.id,
      occurredAt: closedAt,
    });

    return Round.success();
  }

  start(startedAt: Date = new Date()): RoundErrors.RoundResult {
    if (!this.isBettingClosed) {
      return Round.failure(
        new RoundErrors.RoundCanOnlyStartFromBettingClosedError(),
      );
    }

    if (startedAt.getTime() < this.createdAt.getTime()) {
      return Round.failure(
        new RoundErrors.RoundCannotStartBeforeCreationError(),
      );
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

  crash(crashedAt: Date = new Date()): RoundErrors.RoundResult {
    if (!this.isInProgress) {
      return Round.failure(
        new RoundErrors.RoundCanOnlyCrashFromInProgressError(),
      );
    }

    if (this.startedAt && crashedAt.getTime() < this.startedAt.getTime()) {
      return Round.failure(
        new RoundErrors.RoundCannotCrashBeforeItStartsError(),
      );
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

  fail(
    errorReason: string,
    failedAt: Date = new Date(),
  ): RoundErrors.RoundResult {
    if (this.isSettled || this.isError) {
      return Round.failure(
        new RoundErrors.RoundCanOnlyFailFromANonTerminalStatusError(),
      );
    }

    if (!errorReason.trim()) {
      return Round.failure(new RoundErrors.ErrorReasonIsRequiredError());
    }

    if (failedAt.getTime() < this.createdAt.getTime()) {
      return Round.failure(
        new RoundErrors.RoundCannotFailBeforeCreationError(),
      );
    }

    if (this.startedAt && failedAt.getTime() < this.startedAt.getTime()) {
      return Round.failure(
        new RoundErrors.RoundCannotFailBeforeItStartsError(),
      );
    }

    if (this.crashedAt && failedAt.getTime() < this.crashedAt.getTime()) {
      return Round.failure(
        new RoundErrors.RoundCannotFailBeforeItCrashesError(),
      );
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

  settle(): RoundErrors.RoundResult {
    if (!this.isCrashed) {
      return Round.failure(
        new RoundErrors.RoundCanOnlySettleFromCrashedStatusError(),
      );
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

  private static ensureInvariants(
    props: RoundProps,
  ): RoundErrors.RoundResult {
    if (!props.id.trim()) {
      return Round.failure(new RoundErrors.RoundIdIsRequiredError());
    }

    if (!Number.isInteger(props.version) || props.version <= 0) {
      return Round.failure(
        new RoundErrors.RoundVersionMustBeGreaterThanZeroError(),
      );
    }

    if (!props.serverSeed.trim()) {
      return Round.failure(new RoundErrors.ServerSeedIsRequiredError());
    }

    if (!props.serverSeedHash.trim()) {
      return Round.failure(new RoundErrors.ServerSeedHashIsRequiredError());
    }

    if (!props.provablyFairStrategyId.trim()) {
      return Round.failure(
        new RoundErrors.ProvablyFairStrategyIdIsRequiredError(),
      );
    }

    if (!props.nonce.trim()) {
      return Round.failure(new RoundErrors.ProvablyFairNonceIsRequiredError());
    }

    if (props.crashPoint <= 1) {
      return Round.failure(
        new RoundErrors.CrashPointMustBeGreaterThanOneError(),
      );
    }

    if (props.bettingClosesAt.getTime() <= props.createdAt.getTime()) {
      return Round.failure(
        new RoundErrors.BettingCloseTimeMustBeAfterCreationTimeError(),
      );
    }

    if (props.status === RoundStatus.IN_PROGRESS && props.startedAt === null) {
      return Round.failure(
        new RoundErrors.StartedRoundsMustHaveAStartTimeError(),
      );
    }

    if (
      (props.status === RoundStatus.CRASHED ||
        props.status === RoundStatus.SETTLED) &&
      props.crashedAt === null
    ) {
      return Round.failure(
        new RoundErrors.CrashedOrSettledRoundsMustHaveACrashTimeError(),
      );
    }

    if (
      (props.status === RoundStatus.CRASHED ||
        props.status === RoundStatus.SETTLED) &&
      props.crashMultiplier === null
    ) {
      return Round.failure(
        new RoundErrors.CrashedOrSettledRoundsMustHaveACrashMultiplierError(),
      );
    }

    if (props.status === RoundStatus.ERROR && props.failedAt === null) {
      return Round.failure(
        new RoundErrors.ErroredRoundsMustHaveAFailureTimeError(),
      );
    }

    if (
      props.status === RoundStatus.ERROR &&
      (props.errorReason === null || !props.errorReason.trim())
    ) {
      return Round.failure(
        new RoundErrors.ErroredRoundsMustHaveAnErrorReasonError(),
      );
    }

    if (props.status === RoundStatus.ERROR && !props.refundRequired) {
      return Round.failure(
        new RoundErrors.ErroredRoundsMustRequireARefundError(),
      );
    }

    return Round.success();
  }

  private recordDomainEvent(event: RoundDomainEvent): void {
    this._domainEvents.push(event);
  }

  private static success<T>(data?: T): RoundErrors.RoundResult<T> {
    return {
      success: true,
      data,
    };
  }

  private static failure(
    error: RoundErrors.RoundDomainError,
  ): RoundErrors.RoundResult {
    return {
      success: false,
      error,
    };
  }
}

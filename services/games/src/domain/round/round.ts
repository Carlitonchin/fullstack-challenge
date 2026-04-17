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
  strategyDisplayName: string;
  strategyDescription: string;
  algorithm: string;
  hashAlgorithm: string;
  outcomeAlgorithm: string;
  nonce: string;
  serverSeedHash: string;
  serverSeed: string | null;
  isServerSeedRevealed: boolean;
  crashPoint: number | null;
  crashMultiplier: number | null;
  houseEdgeDescription: string;
  verificationFormula: string;
  verificationSteps: { order: number; instruction: string }[];
};

export type RoundProps = {
  id: string;
  version: number;
  status: RoundStatus;
  crashPoint: number;
  provablyFairStrategyId: string;
  nonce: string;
  serverSeedHash: string;
  serverSeed: string;
  bettingClosesAt: Date;
  startsAt: Date;
  startedAt: Date | null;
  scheduledCrashAt: Date;
  settlesAt: Date;
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
  startDelayInMs: number;
  roundDurationInMs: number;
  crashRevealInMs: number;
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
  private _bettingClosesAt: Date;
  private _startsAt: Date;
  private _startedAt: Date | null;
  private _scheduledCrashAt: Date;
  private _settlesAt: Date;
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
    this._bettingClosesAt = props.bettingClosesAt;
    this._startsAt = props.startsAt;
    this._startedAt = props.startedAt;
    this._scheduledCrashAt = props.scheduledCrashAt;
    this._settlesAt = props.settlesAt;
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

    if (props.startDelayInMs < 0) {
      return Round.failure(new RoundErrors.StartDelayCannotBeNegativeError());
    }

    if (props.roundDurationInMs < 0) {
      return Round.failure(
        new RoundErrors.RoundDurationCannotBeNegativeError(),
      );
    }

    if (props.crashRevealInMs < 0) {
      return Round.failure(
        new RoundErrors.CrashRevealCannotBeNegativeError(),
      );
    }

    const bettingClosesAt = new Date(
      props.createdAt.getTime() + props.bettingWindowInSeconds * 1000,
    );
    const startsAt = new Date(
      bettingClosesAt.getTime() + props.startDelayInMs,
    );
    const scheduledCrashAt = new Date(
      startsAt.getTime() + props.roundDurationInMs,
    );
    const settlesAt = new Date(
      scheduledCrashAt.getTime() + props.crashRevealInMs,
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
      bettingClosesAt,
      startsAt,
      startedAt: null,
      scheduledCrashAt,
      settlesAt,
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
      startsAt: round.startsAt,
      scheduledCrashAt: round.scheduledCrashAt,
      settlesAt: round.settlesAt,
      provablyFairStrategyId: round.provablyFairStrategyId,
      nonce: round.nonce,
      serverSeedHash: round.serverSeedHash,
    });

    return Round.success(round);
  }

  static rehydrate(props: RoundProps): RoundErrors.RoundResult<Round> {
    const invariantResult = Round.ensureInvariants(props);

    if (!invariantResult.success) {
      return invariantResult;
    }

    return Round.success(new Round(props));
  }

  get id(): string {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  withVersion(version: number): Round {
    return new Round({
      id: this.id,
      version,
      status: this.status,
      crashPoint: this.crashPoint,
      provablyFairStrategyId: this.provablyFairStrategyId,
      nonce: this.nonce,
      serverSeedHash: this.serverSeedHash,
      serverSeed: this.serverSeed,
      bettingClosesAt: this.bettingClosesAt,
      startsAt: this.startsAt,
      startedAt: this.startedAt,
      scheduledCrashAt: this.scheduledCrashAt,
      settlesAt: this.settlesAt,
      crashedAt: this.crashedAt,
      crashMultiplier: this.crashMultiplier,
      failedAt: this.failedAt,
      errorReason: this.errorReason,
      refundRequired: this.refundRequired,
      createdAt: this.createdAt,
    });
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

  get bettingClosesAt(): Date {
    return this._bettingClosesAt;
  }

  get startsAt(): Date {
    return this._startsAt;
  }

  get startedAt(): Date | null {
    return this._startedAt;
  }

  get scheduledCrashAt(): Date {
    return this._scheduledCrashAt;
  }

  get settlesAt(): Date {
    return this._settlesAt;
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
    return this.isCrashed || this.isSettled || this.isError;
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
      strategyDisplayName: strategyDefinition.displayName,
      strategyDescription: strategyDefinition.description,
      algorithm: strategyDefinition.algorithm,
      hashAlgorithm: strategyDefinition.hashAlgorithm,
      outcomeAlgorithm: strategyDefinition.outcomeAlgorithm,
      nonce: this.nonce,
      serverSeedHash: this.serverSeedHash,
      serverSeed: this.isServerSeedRevealed ? this.serverSeed : null,
      isServerSeedRevealed: this.isServerSeedRevealed,
      crashPoint: this.isServerSeedRevealed ? this.crashPoint : null,
      crashMultiplier: this.crashMultiplier,
      houseEdgeDescription: strategyDefinition.houseEdgeDescription,
      verificationFormula: strategyDefinition.verificationFormula,
      verificationSteps: strategyDefinition.verificationSteps,
    });
  }

  shouldCloseBetting(at: Date = new Date()): boolean {
    return this.isBettingOpen && at.getTime() >= this.bettingClosesAt.getTime();
  }

  shouldStart(at: Date = new Date()): boolean {
    return this.isBettingClosed && at.getTime() >= this.startsAt.getTime();
  }

  shouldCrash(at: Date = new Date()): boolean {
    return this.isInProgress && at.getTime() >= this.scheduledCrashAt.getTime();
  }

  shouldSettle(at: Date = new Date()): boolean {
    return this.isCrashed && at.getTime() >= this.settlesAt.getTime();
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

    if (closedAt.getTime() < this.bettingClosesAt.getTime()) {
      return Round.failure(
        new RoundErrors.BettingCloseTimeMustBeAfterCreationTimeError(),
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

    if (startedAt.getTime() < this.startsAt.getTime()) {
      return Round.failure(
        new RoundErrors.RoundCannotStartBeforeScheduledStartTimeError(),
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

    if (crashedAt.getTime() < this.scheduledCrashAt.getTime()) {
      return Round.failure(
        new RoundErrors.RoundCannotCrashBeforeScheduledCrashTimeError(),
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
    this._errorReason = errorReason.trim();
    this._refundRequired = true;
    this.recordDomainEvent({
      type: "round.failed",
      roundId: this.id,
      occurredAt: failedAt,
      errorReason: this._errorReason,
      refundRequired: true,
    });

    return Round.success();
  }

  settle(settledAt: Date = new Date()): RoundErrors.RoundResult {
    if (!this.isCrashed) {
      return Round.failure(
        new RoundErrors.RoundCanOnlySettleFromCrashedStatusError(),
      );
    }

    if (settledAt.getTime() < this.settlesAt.getTime()) {
      return Round.failure(
        new RoundErrors.RoundCannotSettleBeforeScheduledSettleTimeError(),
      );
    }

    this._status = RoundStatus.SETTLED;
    this.recordDomainEvent({
      type: "round.settled",
      roundId: this.id,
      occurredAt: settledAt,
    });

    return Round.success();
  }

  canAcceptBets(at: Date = new Date()): boolean {
    return this.isBettingOpen && at.getTime() < this.bettingClosesAt.getTime();
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

    if (props.crashPoint < 1) {
      return Round.failure(
        new RoundErrors.CrashPointMustBeGreaterThanOneError(),
      );
    }

    if (props.bettingClosesAt.getTime() <= props.createdAt.getTime()) {
      return Round.failure(
        new RoundErrors.BettingCloseTimeMustBeAfterCreationTimeError(),
      );
    }

    if (props.startsAt.getTime() < props.bettingClosesAt.getTime()) {
      return Round.failure(
        new RoundErrors.RoundStartTimeMustBeAfterBettingCloseTimeError(),
      );
    }

    if (props.scheduledCrashAt.getTime() < props.startsAt.getTime()) {
      return Round.failure(
        new RoundErrors.ScheduledCrashTimeMustBeAtOrAfterRoundStartTimeError(),
      );
    }

    if (props.settlesAt.getTime() < props.scheduledCrashAt.getTime()) {
      return Round.failure(
        new RoundErrors.RoundSettleTimeMustBeAtOrAfterScheduledCrashTimeError(),
      );
    }

    const hasStartedState =
      props.status === RoundStatus.IN_PROGRESS ||
      props.status === RoundStatus.CRASHED ||
      props.status === RoundStatus.SETTLED;

    if (hasStartedState && props.startedAt === null) {
      return Round.failure(
        new RoundErrors.StartedRoundsMustHaveAStartTimeError(),
      );
    }

    if (hasStartedState && !props.startsAt) {
      return Round.failure(
        new RoundErrors.RoundsWithStartedStateMustHaveAScheduledStartTimeError(),
      );
    }

    if (hasStartedState && !props.scheduledCrashAt) {
      return Round.failure(
        new RoundErrors.RoundsWithStartedStateMustHaveAScheduledCrashTimeError(),
      );
    }

    if (hasStartedState && !props.settlesAt) {
      return Round.failure(
        new RoundErrors.RoundsWithStartedStateMustHaveASettleTimeError(),
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

    if (props.status === RoundStatus.ERROR && props.refundRequired !== true) {
      return Round.failure(
        new RoundErrors.ErroredRoundsMustRequireARefundError(),
      );
    }

    if (props.startedAt && props.startedAt.getTime() < props.startsAt.getTime()) {
      return Round.failure(
        new RoundErrors.RoundCannotStartBeforeScheduledStartTimeError(),
      );
    }

    if (
      props.crashedAt &&
      props.crashedAt.getTime() < props.scheduledCrashAt.getTime()
    ) {
      return Round.failure(
        new RoundErrors.RoundCannotCrashBeforeScheduledCrashTimeError(),
      );
    }

    return Round.success();
  }

  private recordDomainEvent(event: RoundDomainEvent): void {
    this._domainEvents.push(event);
  }

  private static success<T>(data?: T): RoundErrors.RoundResult<T> {
    return { success: true, data };
  }

  private static failure<T = undefined>(
    error: RoundErrors.RoundDomainError,
  ): RoundErrors.RoundResult<T> {
    return { success: false, error };
  }
}

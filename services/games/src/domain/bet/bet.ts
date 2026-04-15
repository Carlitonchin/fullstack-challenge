import * as BetErrors from "./bet.errors";
import { BetAmount, type BetCurrency } from "./bet-amount";
import { PayoutAmount } from "./payout-amount";
import { type BetDomainEvent } from "./bet.events";

export enum BetStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  CASHED_OUT = "CASHED_OUT",
  LOST = "LOST",
  SETTLED = "SETTLED",
  REJECTED = "REJECTED",
}

export type BetProps = {
  id: string;
  roundId: string;
  playerId: string;
  amount: BetAmount;
  status: BetStatus;
  placedAt: Date;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  cashedOutAt: Date | null;
  cashoutMultiplier: number | null;
  payoutAmount: PayoutAmount | null;
  lostAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
};

export type NewBetProps = {
  id: string;
  roundId: string;
  playerId: string;
  amount: BetAmount;
  createdAt: Date;
};

type CashOutProps = {
  multiplier: number;
  cashedOutAt?: Date;
};

export class Bet {
  private _id: string;
  private _roundId: string;
  private _playerId: string;
  private _amount: BetAmount;
  private _status: BetStatus;
  private _placedAt: Date;
  private _acceptedAt: Date | null;
  private _rejectedAt: Date | null;
  private _rejectionReason: string | null;
  private _cashedOutAt: Date | null;
  private _cashoutMultiplier: number | null;
  private _payoutAmount: PayoutAmount | null;
  private _lostAt: Date | null;
  private _settledAt: Date | null;
  private _createdAt: Date;
  private _domainEvents: BetDomainEvent[];

  private constructor(props: BetProps) {
    this._id = props.id;
    this._roundId = props.roundId;
    this._playerId = props.playerId;
    this._amount = props.amount;
    this._status = props.status;
    this._placedAt = props.placedAt;
    this._acceptedAt = props.acceptedAt;
    this._rejectedAt = props.rejectedAt;
    this._rejectionReason = props.rejectionReason;
    this._cashedOutAt = props.cashedOutAt;
    this._cashoutMultiplier = props.cashoutMultiplier;
    this._payoutAmount = props.payoutAmount;
    this._lostAt = props.lostAt;
    this._settledAt = props.settledAt;
    this._createdAt = props.createdAt;
    this._domainEvents = [];
  }

  static new(props: NewBetProps): BetErrors.BetResult<Bet> {
    const betProps: BetProps = {
      id: props.id,
      roundId: props.roundId,
      playerId: props.playerId,
      amount: props.amount,
      status: BetStatus.PENDING,
      placedAt: props.createdAt,
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      cashedOutAt: null,
      cashoutMultiplier: null,
      payoutAmount: null,
      lostAt: null,
      settledAt: null,
      createdAt: props.createdAt,
    };

    const invariantResult = Bet.ensureInvariants(betProps);
    if (!invariantResult.success) {
      return invariantResult;
    }

    const bet = new Bet(betProps);

    bet.recordDomainEvent({
      type: "bet.created",
      betId: bet.id,
      roundId: bet.roundId,
      playerId: bet.playerId,
      occurredAt: bet.createdAt,
      amountInCents: bet.amountInCents,
      currency: bet.currency,
    });

    return Bet.success(bet);
  }

  static rehydrate(props: BetProps): BetErrors.BetResult<Bet> {
    return Bet.success(new Bet(props));
  }

  get id(): string {
    return this._id;
  }

  get roundId(): string {
    return this._roundId;
  }

  get playerId(): string {
    return this._playerId;
  }

  get amountInCents(): number {
    return this._amount.amountInCents;
  }

  get currency(): BetCurrency {
    return this._amount.currency;
  }

  get amount(): BetAmount {
    return this._amount;
  }

  get status(): BetStatus {
    return this._status;
  }

  get placedAt(): Date {
    return this._placedAt;
  }

  get acceptedAt(): Date | null {
    return this._acceptedAt;
  }

  get rejectedAt(): Date | null {
    return this._rejectedAt;
  }

  get rejectionReason(): string | null {
    return this._rejectionReason;
  }

  get cashedOutAt(): Date | null {
    return this._cashedOutAt;
  }

  get cashoutMultiplier(): number | null {
    return this._cashoutMultiplier;
  }

  get payoutAmountInCents(): number | null {
    return this._payoutAmount?.amountInCents ?? null;
  }

  get payoutAmount(): PayoutAmount | null {
    return this._payoutAmount;
  }

  get lostAt(): Date | null {
    return this._lostAt;
  }

  get settledAt(): Date | null {
    return this._settledAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  pullDomainEvents(): BetDomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  get isPending(): boolean {
    return this._status === BetStatus.PENDING;
  }

  get isAccepted(): boolean {
    return this._status === BetStatus.ACCEPTED;
  }

  get isCashedOut(): boolean {
    return this._status === BetStatus.CASHED_OUT;
  }

  get isLost(): boolean {
    return this._status === BetStatus.LOST;
  }

  get isSettled(): boolean {
    return this._status === BetStatus.SETTLED;
  }

  get isRejected(): boolean {
    return this._status === BetStatus.REJECTED;
  }

  get isTerminal(): boolean {
    return this.isRejected || this.isSettled;
  }

  accept(acceptedAt: Date = new Date()): BetErrors.BetResult {
    if (!this.isPending) {
      return Bet.failure(
        new BetErrors.BetCanOnlyBeAcceptedFromPendingStatusError(),
      );
    }

    if (acceptedAt.getTime() < this.createdAt.getTime()) {
      return Bet.failure(new BetErrors.BetCannotBeAcceptedBeforeCreationError());
    }

    this._status = BetStatus.ACCEPTED;
    this._acceptedAt = acceptedAt;
    this.recordDomainEvent({
      type: "bet.accepted",
      betId: this.id,
      roundId: this.roundId,
      playerId: this.playerId,
      occurredAt: acceptedAt,
    });

    return Bet.success();
  }

  reject(
    rejectionReason: string,
    rejectedAt: Date = new Date(),
  ): BetErrors.BetResult {
    if (!this.isPending) {
      return Bet.failure(
        new BetErrors.BetCanOnlyBeRejectedFromPendingStatusError(),
      );
    }

    if (!rejectionReason.trim()) {
      return Bet.failure(new BetErrors.RejectionReasonIsRequiredError());
    }

    if (rejectedAt.getTime() < this.createdAt.getTime()) {
      return Bet.failure(new BetErrors.BetCannotBeRejectedBeforeCreationError());
    }

    this._status = BetStatus.REJECTED;
    this._rejectedAt = rejectedAt;
    this._rejectionReason = rejectionReason;
    this.recordDomainEvent({
      type: "bet.rejected",
      betId: this.id,
      roundId: this.roundId,
      playerId: this.playerId,
      occurredAt: rejectedAt,
      rejectionReason,
    });

    return Bet.success();
  }

  cashOut({
    multiplier,
    cashedOutAt = new Date(),
  }: CashOutProps): BetErrors.BetResult {
    if (!this.isAccepted) {
      return Bet.failure(
        new BetErrors.BetCanOnlyCashOutFromAcceptedStatusError(),
      );
    }

    if (multiplier <= 1) {
      return Bet.failure(
        new BetErrors.CashoutMultiplierMustBeGreaterThanOneError(),
      );
    }

    if (
      this.acceptedAt &&
      cashedOutAt.getTime() < this.acceptedAt.getTime()
    ) {
      return Bet.failure(
        new BetErrors.BetCannotCashOutBeforeItIsAcceptedError(),
      );
    }

    const payoutAmountResult = Bet.calculatePayoutAmount({
      stakeAmountInCents: this.amountInCents,
      currency: this.currency,
      multiplier,
    });
    if (!payoutAmountResult.success) {
      return payoutAmountResult;
    }

    this._status = BetStatus.CASHED_OUT;
    this._cashedOutAt = cashedOutAt;
    this._cashoutMultiplier = multiplier;
    this._payoutAmount = payoutAmountResult.data!;
    this.recordDomainEvent({
      type: "bet.cashed-out",
      betId: this.id,
      roundId: this.roundId,
      playerId: this.playerId,
      occurredAt: cashedOutAt,
      cashoutMultiplier: multiplier,
      payoutAmountInCents: this._payoutAmount.amountInCents,
      currency: this._payoutAmount.currency,
    });

    return Bet.success();
  }

  lose(lostAt: Date = new Date()): BetErrors.BetResult {
    if (!this.isAccepted) {
      return Bet.failure(new BetErrors.BetCanOnlyLoseFromAcceptedStatusError());
    }

    if (this.acceptedAt && lostAt.getTime() < this.acceptedAt.getTime()) {
      return Bet.failure(new BetErrors.BetCannotLoseBeforeItIsAcceptedError());
    }

    this._status = BetStatus.LOST;
    this._lostAt = lostAt;
    this.recordDomainEvent({
      type: "bet.lost",
      betId: this.id,
      roundId: this.roundId,
      playerId: this.playerId,
      occurredAt: lostAt,
    });

    return Bet.success();
  }

  settle(settledAt: Date = new Date()): BetErrors.BetResult {
    if (!this.isCashedOut && !this.isLost) {
      return Bet.failure(
        new BetErrors.BetCanOnlySettleFromResolvedStatusError(),
      );
    }

    const resolvedAt = this.cashedOutAt ?? this.lostAt;
    if (resolvedAt && settledAt.getTime() < resolvedAt.getTime()) {
      return Bet.failure(new BetErrors.BetCannotSettleBeforeItIsResolvedError());
    }

    this._status = BetStatus.SETTLED;
    this._settledAt = settledAt;
    this.recordDomainEvent({
      type: "bet.settled",
      betId: this.id,
      roundId: this.roundId,
      playerId: this.playerId,
      occurredAt: settledAt,
    });

    return Bet.success();
  }

  private static ensureInvariants(props: BetProps): BetErrors.BetResult {
    if (!props.id.trim()) {
      return Bet.failure(new BetErrors.BetIdIsRequiredError());
    }

    if (!props.roundId.trim()) {
      return Bet.failure(new BetErrors.RoundIdIsRequiredError());
    }

    if (!props.playerId.trim()) {
      return Bet.failure(new BetErrors.PlayerIdIsRequiredError());
    }

    const amountResult = BetAmount.create({
      amountInCents: props.amount.amountInCents,
      currency: props.amount.currency,
    });
    if (!amountResult.success) {
      return Bet.failure(amountResult.error);
    }

    if (props.placedAt.getTime() !== props.createdAt.getTime()) {
      return Bet.failure(new BetErrors.PlacedAtMustMatchCreatedAtError());
    }

    if (props.status === BetStatus.ACCEPTED && props.acceptedAt === null) {
      return Bet.failure(new BetErrors.AcceptedBetsMustHaveAnAcceptedAtError());
    }

    if (props.status === BetStatus.REJECTED && props.rejectedAt === null) {
      return Bet.failure(new BetErrors.RejectedBetsMustHaveARejectedAtError());
    }

    if (
      props.status === BetStatus.REJECTED &&
      (props.rejectionReason === null || !props.rejectionReason.trim())
    ) {
      return Bet.failure(
        new BetErrors.RejectedBetsMustHaveARejectionReasonError(),
      );
    }

    if (
      props.status === BetStatus.CASHED_OUT &&
      props.cashedOutAt === null
    ) {
      return Bet.failure(
        new BetErrors.CashedOutBetsMustHaveACashedOutAtError(),
      );
    }

    if (
      props.status === BetStatus.CASHED_OUT &&
      props.cashoutMultiplier === null
    ) {
      return Bet.failure(
        new BetErrors.CashedOutBetsMustHaveACashoutMultiplierError(),
      );
    }

    if (
      props.status === BetStatus.CASHED_OUT &&
      props.payoutAmount === null
    ) {
      return Bet.failure(new BetErrors.CashedOutBetsMustHaveAPayoutAmountError());
    }

    if (props.status === BetStatus.LOST && props.lostAt === null) {
      return Bet.failure(new BetErrors.LostBetsMustHaveALostAtError());
    }

    if (props.status === BetStatus.SETTLED && props.settledAt === null) {
      return Bet.failure(new BetErrors.SettledBetsMustHaveASettledAtError());
    }

    const hasRejectedData =
      props.rejectedAt !== null || props.rejectionReason !== null;
    const hasCashoutData =
      props.cashedOutAt !== null ||
      props.cashoutMultiplier !== null ||
      props.payoutAmount !== null;
    const hasLostData = props.lostAt !== null;
    const hasResolvedData = hasCashoutData || hasLostData || props.settledAt !== null;

    if (hasRejectedData && hasResolvedData) {
      return Bet.failure(new BetErrors.BetsCannotMixRejectedAndResolvedDataError());
    }

    if (hasCashoutData && hasLostData) {
      return Bet.failure(new BetErrors.BetsCannotMixCashoutAndLossDataError());
    }

    if (
      (hasCashoutData || hasLostData || props.status === BetStatus.SETTLED) &&
      props.acceptedAt === null
    ) {
      return Bet.failure(new BetErrors.ResolvedBetsMustHaveAnAcceptedAtError());
    }

    if (props.status === BetStatus.SETTLED && !hasCashoutData && !hasLostData) {
      return Bet.failure(new BetErrors.SettledBetsMustHaveAResolutionError());
    }

    if (
      props.status === BetStatus.PENDING &&
      (props.acceptedAt !== null || hasRejectedData || hasResolvedData)
    ) {
      return Bet.failure(
        new BetErrors.BetStatusDoesNotMatchStoredResolutionDataError(),
      );
    }

    if (
      props.status === BetStatus.ACCEPTED &&
      (props.acceptedAt === null || hasRejectedData || hasResolvedData)
    ) {
      return Bet.failure(
        new BetErrors.BetStatusDoesNotMatchStoredResolutionDataError(),
      );
    }

    if (
      props.status === BetStatus.REJECTED &&
      (props.acceptedAt !== null || hasCashoutData || hasLostData || props.settledAt !== null)
    ) {
      return Bet.failure(
        new BetErrors.BetStatusDoesNotMatchStoredResolutionDataError(),
      );
    }

    if (
      props.status === BetStatus.CASHED_OUT &&
      (props.acceptedAt === null || hasRejectedData || hasLostData || props.settledAt !== null)
    ) {
      return Bet.failure(
        new BetErrors.BetStatusDoesNotMatchStoredResolutionDataError(),
      );
    }

    if (
      props.status === BetStatus.LOST &&
      (props.acceptedAt === null || hasRejectedData || hasCashoutData || props.settledAt !== null)
    ) {
      return Bet.failure(
        new BetErrors.BetStatusDoesNotMatchStoredResolutionDataError(),
      );
    }

    if (hasCashoutData) {
      if (props.cashedOutAt === null) {
        return Bet.failure(
          new BetErrors.CashedOutBetsMustHaveACashedOutAtError(),
        );
      }

      if (props.cashoutMultiplier === null) {
        return Bet.failure(
          new BetErrors.CashedOutBetsMustHaveACashoutMultiplierError(),
        );
      }

      if (props.cashoutMultiplier <= 1) {
        return Bet.failure(
          new BetErrors.CashoutMultiplierMustBeGreaterThanOneError(),
        );
      }

      if (props.payoutAmount === null) {
        return Bet.failure(
          new BetErrors.CashedOutBetsMustHaveAPayoutAmountError(),
        );
      }

      const payoutAmountResult = PayoutAmount.create({
        amountInCents: props.payoutAmount.amountInCents,
        currency: props.payoutAmount.currency,
      });
      if (!payoutAmountResult.success) {
        return Bet.failure(payoutAmountResult.error);
      }

      if (props.payoutAmount.currency !== props.amount.currency) {
        return Bet.failure(
          new BetErrors.PayoutAmountCurrencyMustMatchBetAmountCurrencyError(),
        );
      }

      if (props.payoutAmount.amountInCents < props.amount.amountInCents) {
        return Bet.failure(
          new BetErrors.PayoutAmountInCentsMustBeGreaterThanOrEqualToStakeError(),
        );
      }

      const expectedPayoutAmountResult = Bet.calculatePayoutAmount({
        stakeAmountInCents: props.amount.amountInCents,
        currency: props.amount.currency,
        multiplier: props.cashoutMultiplier,
      });
      if (!expectedPayoutAmountResult.success) {
        return expectedPayoutAmountResult;
      }

      if (!props.payoutAmount.equals(expectedPayoutAmountResult.data!)) {
        return Bet.failure(
          new BetErrors.PayoutAmountMustMatchCashoutMultiplierError(),
        );
      }
    }

    if (
      props.acceptedAt !== null &&
      props.acceptedAt.getTime() < props.createdAt.getTime()
    ) {
      return Bet.failure(new BetErrors.BetTimestampsMustFollowCausalOrderError());
    }

    if (
      props.rejectedAt !== null &&
      props.rejectedAt.getTime() < props.createdAt.getTime()
    ) {
      return Bet.failure(new BetErrors.BetTimestampsMustFollowCausalOrderError());
    }

    if (
      props.cashedOutAt !== null &&
      ((props.acceptedAt !== null &&
        props.cashedOutAt.getTime() < props.acceptedAt.getTime()) ||
        props.cashedOutAt.getTime() < props.createdAt.getTime())
    ) {
      return Bet.failure(new BetErrors.BetTimestampsMustFollowCausalOrderError());
    }

    if (
      props.lostAt !== null &&
      ((props.acceptedAt !== null &&
        props.lostAt.getTime() < props.acceptedAt.getTime()) ||
        props.lostAt.getTime() < props.createdAt.getTime())
    ) {
      return Bet.failure(new BetErrors.BetTimestampsMustFollowCausalOrderError());
    }

    if (
      props.settledAt !== null &&
      ((props.cashedOutAt !== null &&
        props.settledAt.getTime() < props.cashedOutAt.getTime()) ||
        (props.lostAt !== null &&
          props.settledAt.getTime() < props.lostAt.getTime()) ||
        props.settledAt.getTime() < props.createdAt.getTime())
    ) {
      return Bet.failure(new BetErrors.BetTimestampsMustFollowCausalOrderError());
    }

    return Bet.success();
  }

  private recordDomainEvent(event: BetDomainEvent): void {
    this._domainEvents.push(event);
  }

  private static calculatePayoutAmount({
    stakeAmountInCents,
    currency,
    multiplier,
  }: {
    stakeAmountInCents: number;
    currency: BetCurrency;
    multiplier: number;
  }): BetErrors.BetResult<PayoutAmount> {
    const multiplierScaleResult = Bet.toScaledMultiplier(multiplier);
    if (!multiplierScaleResult.success) {
      return multiplierScaleResult;
    }

    const { numerator, scale } = multiplierScaleResult.data!;
    const payoutAmountInCents = Math.floor(
      (stakeAmountInCents * numerator) / scale,
    );

    if (payoutAmountInCents < stakeAmountInCents) {
      return Bet.failure(
        new BetErrors.PayoutAmountInCentsMustBeGreaterThanOrEqualToStakeError(),
      );
    }

    return PayoutAmount.create({
      amountInCents: payoutAmountInCents,
      currency,
    });
  }

  private static toScaledMultiplier(
    multiplier: number,
  ): BetErrors.BetResult<{ numerator: number; scale: number }> {
    if (!Number.isFinite(multiplier) || multiplier <= 1) {
      return Bet.failure(
        new BetErrors.CashoutMultiplierMustBeGreaterThanOneError(),
      );
    }

    const normalizedMultiplier = multiplier.toString();
    const [integerPart, decimalPart = ""] = normalizedMultiplier.split(".");
    const digits = `${integerPart}${decimalPart}`;
    const numerator = Number.parseInt(digits, 10);
    const scale = 10 ** decimalPart.length;

    if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(scale)) {
      return Bet.failure(
        new BetErrors.CashoutMultiplierMustBeGreaterThanOneError(),
      );
    }

    return Bet.success({ numerator, scale });
  }

  private static success<T>(data?: T): BetErrors.BetResult<T> {
    return { success: true, data };
  }

  private static failure<T = undefined>(
    error: BetErrors.BetDomainError,
  ): BetErrors.BetResult<T> {
    return { success: false, error };
  }
}

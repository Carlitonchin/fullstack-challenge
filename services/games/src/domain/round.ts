export enum RoundStatus {
  BETTING_OPEN = "BETTING_OPEN",
  BETTING_CLOSED = "BETTING_CLOSED",
  IN_PROGRESS = "IN_PROGRESS",
  CRASHED = "CRASHED",
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
  private _createdAt: Date;

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
    this._createdAt = props.createdAt;
    this.ensureInvariants();
  }

  static new(props: NewRoundProps): Round {
    if (props.bettingWindowInSeconds <= 0) {
      throw new Error("Betting window must be greater than zero");
    }

    const bettingClosesAt = new Date(
      props.createdAt.getTime() + props.bettingWindowInSeconds * 1000,
    );

    return new Round({
      id: props.id,
      status: RoundStatus.BETTING_OPEN,
      crashPoint: props.crashPoint,
      serverSeedHash: props.serverSeedHash,
      serverSeed: props.serverSeed,
      startedAt: null,
      bettingClosesAt,
      crashedAt: null,
      crashMultiplier: null,
      createdAt: props.createdAt,
    });
  }

  static rehydrate(props: RoundProps): Round {
    return new Round(props);
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

  get createdAt(): Date {
    return this._createdAt;
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

  get isSettled(): boolean {
    return this._status === RoundStatus.SETTLED;
  }

  closeBetting(closedAt: Date = new Date()): void {
    if (!this.isBettingOpen) {
      throw new Error("Round can only close betting from BETTING_OPEN status");
    }

    if (closedAt.getTime() < this.createdAt.getTime()) {
      throw new Error("Betting cannot close before round creation");
    }

    this._status = RoundStatus.BETTING_CLOSED;
  }

  start(startedAt: Date = new Date()): void {
    if (!this.isBettingClosed) {
      throw new Error("Round can only start from BETTING_CLOSED status");
    }

    if (startedAt.getTime() < this.createdAt.getTime()) {
      throw new Error("Round cannot start before creation");
    }

    this._status = RoundStatus.IN_PROGRESS;
    this._startedAt = startedAt;
  }

  crash(crashedAt: Date = new Date()): void {
    if (!this.isInProgress) {
      throw new Error("Round can only crash from IN_PROGRESS status");
    }

    if (this.startedAt && crashedAt.getTime() < this.startedAt.getTime()) {
      throw new Error("Round cannot crash before it starts");
    }

    this._status = RoundStatus.CRASHED;
    this._crashedAt = crashedAt;
    this._crashMultiplier = this._crashPoint;
  }

  settle(): void {
    if (!this.isCrashed) {
      throw new Error("Round can only settle from CRASHED status");
    }

    this._status = RoundStatus.SETTLED;
  }

  canAcceptBets(at: Date = new Date()): boolean {
    return (
      this.isBettingOpen && at.getTime() <= this.bettingClosesAt.getTime()
    );
  }

  private ensureInvariants(): void {
    if (!this._id.trim()) {
      throw new Error("Round id is required");
    }

    if (!this._serverSeed.trim()) {
      throw new Error("Server seed is required");
    }

    if (!this._serverSeedHash.trim()) {
      throw new Error("Server seed hash is required");
    }

    if (this._crashPoint <= 1) {
      throw new Error("Crash point must be greater than 1");
    }

    if (this._bettingClosesAt.getTime() <= this._createdAt.getTime()) {
      throw new Error("Betting close time must be after creation time");
    }

    if (
      this._status === RoundStatus.IN_PROGRESS &&
      this._startedAt === null
    ) {
      throw new Error("Started rounds must have a start time");
    }

    if (
      (this._status === RoundStatus.CRASHED ||
        this._status === RoundStatus.SETTLED) &&
      this._crashedAt === null
    ) {
      throw new Error("Crashed or settled rounds must have a crash time");
    }

    if (
      (this._status === RoundStatus.CRASHED ||
        this._status === RoundStatus.SETTLED) &&
      this._crashMultiplier === null
    ) {
      throw new Error("Crashed or settled rounds must have a crash multiplier");
    }
  }
}

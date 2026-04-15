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
  serverSeed: string | null;
  startedAt: Date | null;
  bettingClosesAt: Date;
  crashedAt: Date | null;
  crashMultiplier: number | null;
};

export class Round {
  private _id: string;
  private _status: RoundStatus;
  private _crashPoint: number;
  private _serverSeedHash: string;
  private _serverSeed: string | null;
  private _startedAt: Date | null;
  private _bettingClosesAt: Date;
  private _crashedAt: Date | null;
  private _crashMultiplier: number | null;

  constructor(props: RoundProps) {
    this._id = props.id;
    this._status = props.status;
    this._crashPoint = props.crashPoint;
    this._serverSeedHash = props.serverSeedHash;
    this._serverSeed = props.serverSeed;
    this._startedAt = props.startedAt;
    this._bettingClosesAt = props.bettingClosesAt;
    this._crashedAt = props.crashedAt;
    this._crashMultiplier = props.crashMultiplier;
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

  get serverSeed(): string | null {
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
}

/// <reference types="bun-types" />

import { expect } from "bun:test";

export type GameBetView = {
  id: string;
  roundId: string;
  playerId: string;
  playerUsername: string;
  amountInCents: number;
  currency: "BRL";
  status: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  cashoutMultiplier: number | null;
  roundCrashMultiplier: number | null;
  payoutAmountInCents: number | null;
  createdAt: string;
  settledAt: string | null;
};

export type CurrentRoundView = {
  id: string;
  status: string;
  bettingClosesAt: string | null;
  startsAt: string | null;
  startedAt: string | null;
  scheduledCrashAt: string | null;
  settlesAt: string | null;
  crashedAt: string | null;
  currentMultiplier: number;
  crashPoint: number | null;
};

type CurrentSnapshotResponse = {
  serverTime: string;
  round: CurrentRoundView | null;
  bets: GameBetView[];
};

type WalletResponse = {
  id: string;
  playerId: string;
  currency: string;
  balanceInCents: string;
  balance: string;
  createdAt: string;
  updatedAt: string;
};

type PaginatedBetsResponse = {
  items: GameBetView[];
};

type PlaceBetResponse = {
  id: string;
  roundId: string;
};

type CashoutResponse = {
  multiplier: number;
  payoutAmountInCents: number;
};

type HttpResponse<T> = {
  status: number;
  body: T;
};

export class E2eSystemClient {
  readonly kongBaseUrl =
    process.env.E2E_KONG_BASE_URL?.trim() || "http://localhost:8000";
  readonly keycloakBaseUrl =
    process.env.E2E_KEYCLOAK_BASE_URL?.trim() || "http://localhost:8080";
  readonly keycloakRealm =
    process.env.E2E_KEYCLOAK_REALM?.trim() || "crash-game";
  readonly keycloakClientId =
    process.env.E2E_KEYCLOAK_CLIENT_ID?.trim() || "crash-game-client";
  readonly username =
    process.env.E2E_PLAYER_USERNAME?.trim() || "player";
  readonly password =
    process.env.E2E_PLAYER_PASSWORD?.trim() || "player123";
  readonly pollIntervalMs = Number.parseInt(
    process.env.E2E_POLL_INTERVAL_MS?.trim() || "500",
    10,
  );
  readonly timeoutMs = Number.parseInt(
    process.env.E2E_TIMEOUT_MS?.trim() || "120000",
    10,
  );
  readonly cashoutTargetMultiplier = Number.parseFloat(
    process.env.E2E_CASHOUT_TARGET_MULTIPLIER?.trim() || "1.05",
  );

  private accessToken: string | null = null;

  async ensureAuthenticated(): Promise<void> {
    if (this.accessToken) {
      return;
    }

    const tokenEndpoint = new URL(
      `/realms/${this.keycloakRealm}/protocol/openid-connect/token`,
      this.keycloakBaseUrl,
    );
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: this.keycloakClientId,
        username: this.username,
        password: this.password,
      }),
    });

    const payload = (await response.json()) as { access_token?: string };
    expect(response.status).toBe(200);
    expect(typeof payload.access_token).toBe("string");
    this.accessToken = payload.access_token ?? null;
  }

  async ensureWallet(): Promise<WalletResponse> {
    await this.ensureAuthenticated();

    const existingWallet = await this.getWallet();
    if (existingWallet.status === 200) {
      return existingWallet.body as WalletResponse;
    }

    expect(existingWallet.status).toBe(404);

    const createdWallet = await this.request<WalletResponse>({
      path: "/wallets",
      method: "POST",
      authenticated: true,
    });

    expect(createdWallet.status).toBe(201);
    return createdWallet.body;
  }

  async getWallet(): Promise<HttpResponse<WalletResponse | { message?: string }>> {
    return this.request<WalletResponse | { message?: string }>({
      path: "/wallets/me",
      authenticated: true,
    });
  }

  async getCurrentSnapshot(): Promise<CurrentSnapshotResponse> {
    const response = await this.request<CurrentSnapshotResponse>({
      path: "/games/rounds/current",
    });
    expect(response.status).toBe(200);
    return response.body;
  }

  async getMyBets(): Promise<GameBetView[]> {
    const response = await this.request<PaginatedBetsResponse>({
      path: "/games/bets/me?limit=50",
      authenticated: true,
    });
    expect(response.status).toBe(200);
    return response.body.items;
  }

  async getBetById(betId: string): Promise<GameBetView | null> {
    const bets = await this.getMyBets();
    return bets.find((bet) => bet.id === betId) ?? null;
  }

  async placeBet(amount: string): Promise<HttpResponse<PlaceBetResponse | { message?: string }>> {
    return this.request<PlaceBetResponse | { message?: string }>({
      path: "/games/bet",
      method: "POST",
      authenticated: true,
      json: { amount },
    });
  }

  async cashout(): Promise<HttpResponse<CashoutResponse | { message?: string }>> {
    return this.request<CashoutResponse | { message?: string }>({
      path: "/games/bet/cashout",
      method: "POST",
      authenticated: true,
    });
  }

  async waitForRound(
    predicate: (snapshot: CurrentSnapshotResponse) => boolean,
    description: string,
    timeoutMs = this.timeoutMs,
  ): Promise<CurrentSnapshotResponse> {
    return this.waitFor(
      async () => {
        const snapshot = await this.getCurrentSnapshot();
        return predicate(snapshot) ? snapshot : null;
      },
      description,
      timeoutMs,
    );
  }

  async waitForBet(
    betId: string,
    predicate: (bet: GameBetView) => boolean,
    description: string,
    timeoutMs = this.timeoutMs,
  ): Promise<GameBetView> {
    return this.waitFor(
      async () => {
        const bet = await this.getBetById(betId);
        return bet && predicate(bet) ? bet : null;
      },
      description,
      timeoutMs,
    );
  }

  async waitForWalletBalance(
    predicate: (balanceInCents: bigint) => boolean,
    description: string,
    timeoutMs = this.timeoutMs,
  ): Promise<bigint> {
    return this.waitFor(
      async () => {
        const wallet = await this.ensureWallet();
        const balanceInCents = BigInt(wallet.balanceInCents);
        return predicate(balanceInCents) ? balanceInCents : null;
      },
      description,
      timeoutMs,
    );
  }

  async waitFor<T>(
    producer: () => Promise<T | null>,
    description: string,
    timeoutMs = this.timeoutMs,
  ): Promise<T> {
    const startedAt = Date.now();
    let lastError: unknown;

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const value = await producer();
        if (value !== null) {
          return value;
        }
      } catch (error) {
        lastError = error;
      }

      await Bun.sleep(this.pollIntervalMs);
    }

    const suffix =
      lastError instanceof Error ? ` (${lastError.message})` : "";
    throw new Error(`Timed out while waiting for ${description}${suffix}`);
  }

  private async request<T>(params: {
    path: string;
    method?: string;
    authenticated?: boolean;
    json?: unknown;
  }): Promise<HttpResponse<T>> {
    if (params.authenticated) {
      await this.ensureAuthenticated();
    }

    const url = new URL(params.path, this.kongBaseUrl);
    const headers = new Headers();

    if (params.authenticated && this.accessToken) {
      headers.set("authorization", `Bearer ${this.accessToken}`);
    }

    let body: string | undefined;
    if (params.json !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(params.json);
    }

    const response = await fetch(url, {
      method: params.method ?? "GET",
      headers,
      body,
    });
    const text = await response.text();

    return {
      status: response.status,
      body: (text ? JSON.parse(text) : null) as T,
    };
  }
}

export function balanceDelta(before: bigint, after: bigint): bigint {
  return after - before;
}

export function roundIsAcceptingBets(round: CurrentRoundView | null): boolean {
  if (!round) {
    return false;
  }

  return round.status === "WAITING_FOR_FIRST_BET" || round.status === "BETTING_OPEN";
}

export function roundHasComfortableBetWindow(snapshot: CurrentSnapshotResponse): boolean {
  if (!roundIsAcceptingBets(snapshot.round)) {
    return false;
  }

  if (snapshot.round?.status === "WAITING_FOR_FIRST_BET") {
    return true;
  }

  if (!snapshot.round?.bettingClosesAt) {
    return false;
  }

  const closesAt = new Date(snapshot.round.bettingClosesAt).getTime();
  const serverTime = new Date(snapshot.serverTime).getTime();

  return closesAt - serverTime >= 3_000;
}

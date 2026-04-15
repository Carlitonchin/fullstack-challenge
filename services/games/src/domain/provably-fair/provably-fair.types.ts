export type ProvablyFairInputs = {
  serverSeed: string;
  nonce: string;
};

export type ProvablyFairCommitment = {
  strategyId: string;
  serverSeedHash: string;
};

export type ProvablyFairOutcome = {
  strategyId: string;
  serverSeedHash: string;
  crashPoint: number;
};

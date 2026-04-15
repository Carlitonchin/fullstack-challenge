export type ProvablyFairInputs = {
  serverSeed: string;
  nonce: string;
};

export type ProvablyFairCommitment = {
  algorithm: string;
  serverSeedHash: string;
};

export type ProvablyFairOutcome = {
  algorithm: string;
  serverSeedHash: string;
  crashPoint: number;
};

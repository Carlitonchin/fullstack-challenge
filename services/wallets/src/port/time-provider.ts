export const TIME_PROVIDER = Symbol("TIME_PROVIDER");

export interface ITimeProvider {
  now(): Date;
}

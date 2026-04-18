import { BadRequestException } from "@nestjs/common";

export const DEFAULT_PAGINATION_PAGE = 1;
export const DEFAULT_PAGINATION_LIMIT = 20;
export const MAX_PAGINATION_LIMIT = 100;

export type PaginationQuery = {
  page: number;
  limit: number;
  offset: number;
};

export function parsePaginationQuery(
  rawPage?: string,
  rawLimit?: string,
): PaginationQuery {
  const page = parsePositiveInteger(
    rawPage,
    "page",
    DEFAULT_PAGINATION_PAGE,
  );
  const limit = parsePositiveInteger(
    rawLimit,
    "limit",
    DEFAULT_PAGINATION_LIMIT,
  );

  if (limit > MAX_PAGINATION_LIMIT) {
    throw new BadRequestException(
      `Query param "limit" must be less than or equal to ${MAX_PAGINATION_LIMIT}`,
    );
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function parsePositiveInteger(
  rawValue: string | undefined,
  fieldName: string,
  defaultValue: number,
): number {
  if (rawValue === undefined) {
    return defaultValue;
  }

  const normalizedValue = rawValue.trim();

  if (!/^\d+$/.test(normalizedValue)) {
    throw new BadRequestException(
      `Query param "${fieldName}" must be a positive integer`,
    );
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);

  if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
    throw new BadRequestException(
      `Query param "${fieldName}" must be greater than or equal to 1`,
    );
  }

  return parsedValue;
}

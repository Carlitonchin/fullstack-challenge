export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export function buildPaginatedResponse<T>(params: {
  items: T[];
  page: number;
  limit: number;
  totalItems: number;
}): PaginatedResponse<T> {
  const totalPages =
    params.totalItems === 0 ? 0 : Math.ceil(params.totalItems / params.limit);

  return {
    items: params.items,
    page: params.page,
    limit: params.limit,
    totalItems: params.totalItems,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1 && totalPages > 0,
  };
}

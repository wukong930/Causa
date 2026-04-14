export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  meta?: ApiMeta;
}

export interface ApiMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export interface ApiListResponse<T> extends ApiResponse<T[]> {
  meta: Required<Pick<ApiMeta, "total" | "page" | "pageSize">>;
}

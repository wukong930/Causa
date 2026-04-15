export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data: T;
  success: true;
  error?: never;
}

export interface ApiResponseError {
  success: false;
  data?: never;
  error: ApiError;
}

export type ApiResult<T> = ApiResponse<T> | ApiResponseError;

export interface ApiMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export interface ApiListResponse<T> extends Omit<ApiResponse<T[]>, 'data'> {
  data: T[];
  meta: Required<Pick<ApiMeta, "total" | "page" | "pageSize">>;
}

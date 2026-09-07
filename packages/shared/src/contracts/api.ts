export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  path?: string;
}

export interface ApiEnvelope<T = any> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp?: string;
    [key: string]: any;
  };
}

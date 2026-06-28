export class HttpClientError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

export class HttpRequestError extends HttpClientError {}

export class HttpTimeoutError extends HttpRequestError {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
  }
}

export class CollectionNotFoundError extends HttpClientError {
  constructor(path: string) {
    super(`Collection file not found: ${path}`);
  }
}

export class CollectionParseError extends HttpClientError {
  constructor(path: string, detail: string) {
    super(`Failed to parse collection at ${path}: ${detail}`);
  }
}

export class InvalidJsonError extends HttpClientError {
  constructor(detail: string) {
    super(`Invalid JSON: ${detail}`);
  }
}

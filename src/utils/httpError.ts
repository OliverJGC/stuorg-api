export class HttpError extends Error {
  public readonly status: number;

  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "HttpError";
    this.status = statusCode;
  }
}

export class AppError extends Error {
  constructor(message, status = 400, code = "BAD_REQUEST", details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const badRequest = (m, details) => new AppError(m, 400, "BAD_REQUEST", details);
export const unauthorized = (m = "Authentication required") => new AppError(m, 401, "UNAUTHENTICATED");
export const forbidden = (m = "You do not have permission to do that") => new AppError(m, 403, "FORBIDDEN");
export const notFound = (m = "Not found") => new AppError(m, 404, "NOT_FOUND");
export const conflict = (m) => new AppError(m, 409, "CONFLICT");
export const tooMany = (m = "Too many requests. Please try again later.", retryAfter) => {
  const e = new AppError(m, 429, "RATE_LIMITED");
  e.retryAfter = retryAfter;
  return e;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
import { ZodError } from "zod";

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const ErrorCode = {
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
  AUTH_FORBIDDEN: "AUTH_FORBIDDEN",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  WALLET_INSUFFICIENT_BALANCE: "WALLET_INSUFFICIENT_BALANCE",
  WALLET_NOT_FOUND: "WALLET_NOT_FOUND",
  WALLET_TRANSACTION_FAILED: "WALLET_TRANSACTION_FAILED",
  BOOKING_NOT_FOUND: "BOOKING_NOT_FOUND",
  BOOKING_CONFLICT: "BOOKING_CONFLICT",
  BOOKING_CANCELLATION_FAILED: "BOOKING_CANCELLATION_FAILED",
  AI_SERVICE_UNAVAILABLE: "AI_SERVICE_UNAVAILABLE",
  AI_RATE_LIMIT_EXCEEDED: "AI_RATE_LIMIT_EXCEEDED",
  VALIDATION_INPUT: "VALIDATION_INPUT",
  VALIDATION_SCHEMA: "VALIDATION_SCHEMA",
  INTERNAL_SERVER: "INTERNAL_SERVER_ERROR",
  INTERNAL_DATABASE: "DATABASE_ERROR",
  INTERNAL_REDIS: "REDIS_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  MISSING_DATA: "MISSING_DATA",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  CONFIG_ERROR: "CONFIG_ERROR",
  WEBHOOK_INVALID: "WEBHOOK_INVALID",
  TRANSACTION_NOT_FOUND: "TRANSACTION_NOT_FOUND",
  INVALID_AMOUNT: "INVALID_AMOUNT",
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId?: string;
  };
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ErrorCode.INTERNAL_SERVER,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON(): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: new Date().toISOString(),
        requestId: this.requestId,
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ZodError | unknown) {
    super(message, 400, ErrorCode.VALIDATION_INPUT, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, ErrorCode.AUTH_UNAUTHORIZED);
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(required: number, available: number) {
    super(
      `Insufficient balance: required ₹${required}, available ₹${available}`,
      402,
      ErrorCode.WALLET_INSUFFICIENT_BALANCE,
      { required, available },
    );
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, ErrorCode.NOT_FOUND);
  }
}

export function withErrorHandler<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
): T {
  return (async (req: Request, ...args: any[]) => {
    const requestId = crypto.randomUUID?.() || Date.now().toString();
    const startTime = Date.now();

    try {
      const response = await handler(req, ...args);
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        console.warn(`[Slow API] ${req.url} took ${duration}ms (${requestId})`);
      }
      response.headers.set("X-Request-Id", requestId);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[API Error] ${req.url} (${duration}ms)`, {
        error: error instanceof Error ? error.stack : error,
        requestId,
      });

      if (error instanceof AppError) {
        const response = new Response(
          JSON.stringify(error.toJSON()),
          {
            status: error.statusCode,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
        return response;
      }

      if (error instanceof ZodError) {
        const appError = new ValidationError("Validation failed", error);
        const response = new Response(
          JSON.stringify(appError.toJSON()),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
            },
          },
        );
        return response;
      }

      const appError = new AppError(
        "Internal server error",
        500,
        ErrorCode.INTERNAL_SERVER,
        process.env.NODE_ENV === "development" ? String(error) : undefined,
        requestId,
      );
      const response = new Response(
        JSON.stringify(appError.toJSON()),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
      return response;
    }
  }) as T;
}

// BATCH1_APPLIED

// ═══════════════════════════════════════════════════════════════════════════════
// Postgres error mapper
// ═══════════════════════════════════════════════════════════════════════════════
// Maps Postgres error codes to structured app errors with friendly messages.
// Never leak raw SQL to the client.

export interface MappedPgError {
  code: string;
  userMessage: string;
  httpStatus: number;
}

export function mapPgError(code: string, message: string): MappedPgError {
  const msg = message.toLowerCase();

  // Unique violation
  if (code === "23505") {
    if (msg.includes("username")) {
      return { code: "USERNAME_TAKEN", userMessage: "That username is already taken. Try another.", httpStatus: 409 };
    }
    return { code: "DUPLICATE", userMessage: "This already exists.", httpStatus: 409 };
  }

  // Foreign key violation
  if (code === "23503") {
    return { code: "INVALID_REFERENCE", userMessage: "Referenced item does not exist.", httpStatus: 400 };
  }

  // RLS policy violation
  if (code === "42501") {
    if (msg.includes("post") || msg.includes("limit")) {
      return { code: "POST_LIMIT_REACHED", userMessage: "You've reached your post limit. Delete a post to create a new one.", httpStatus: 403 };
    }
    return { code: "FORBIDDEN", userMessage: "You don't have permission to do that.", httpStatus: 403 };
  }

  // Trigger raise_exception (P0001)
  if (code === "P0001") {
    if (msg.includes("reserved")) {
      return { code: "USERNAME_RESERVED", userMessage: "That username is reserved. Please choose a different one.", httpStatus: 400 };
    }
    if (msg.includes("username")) {
      return { code: "INVALID_USERNAME_FORMAT", userMessage: "Usernames can only contain letters, numbers, and underscores.", httpStatus: 400 };
    }
    return { code: "VALIDATION", userMessage: message || "Invalid input.", httpStatus: 400 };
  }

  // Check violation
  if (code === "23514") {
    return { code: "VALIDATION", userMessage: "One of the fields is invalid.", httpStatus: 400 };
  }

  return { code: "INTERNAL", userMessage: "Something went wrong. Please try again.", httpStatus: 500 };
}

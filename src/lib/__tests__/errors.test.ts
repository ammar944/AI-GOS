import { describe, it, expect } from "vitest";
import {
  ErrorCode,
  createErrorResponse,
  mapFailureReasonToCode,
  getHttpStatusForCode,
  type FailureReason,
} from "../errors";

describe("errors.ts", () => {
  describe("ErrorCode enum", () => {
    it("contains all expected error codes", () => {
      expect(ErrorCode.TIMEOUT).toBe("TIMEOUT");
      expect(ErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
      expect(ErrorCode.CIRCUIT_OPEN).toBe("CIRCUIT_OPEN");
      expect(ErrorCode.VALIDATION_FAILED).toBe("VALIDATION_FAILED");
      expect(ErrorCode.PARSE_ERROR).toBe("PARSE_ERROR");
      expect(ErrorCode.API_ERROR).toBe("API_ERROR");
      expect(ErrorCode.INVALID_INPUT).toBe("INVALID_INPUT");
      expect(ErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
    });

    it("has exactly 8 error codes", () => {
      const codes = Object.values(ErrorCode);
      expect(codes).toHaveLength(8);
    });
  });

  describe("createErrorResponse", () => {
    it("returns correct structure with required fields", () => {
      // Act
      const response = createErrorResponse(
        ErrorCode.TIMEOUT,
        "Request timed out"
      );

      // Assert
      expect(response).toMatchObject({
        success: false,
        error: {
          code: ErrorCode.TIMEOUT,
          message: "Request timed out",
          retryable: true, // TIMEOUT is retryable
        },
      });
    });

    it("includes details when provided", () => {
      // Act
      const response = createErrorResponse(
        ErrorCode.VALIDATION_FAILED,
        "Validation failed",
        { details: "Missing required field: name" }
      );

      // Assert
      expect(response.error.details).toBe("Missing required field: name");
    });

    it("excludes details when not provided", () => {
      // Act
      const response = createErrorResponse(ErrorCode.API_ERROR, "API failed");

      // Assert
      expect(response.error).not.toHaveProperty("details");
    });

    it("includes section when provided", () => {
      // Act
      const response = createErrorResponse(ErrorCode.TIMEOUT, "Timed out", {
        section: "industryMarket",
      });

      // Assert
      expect(response.error.section).toBe("industryMarket");
    });

    it("includes completedSections when provided", () => {
      // Act
      const response = createErrorResponse(ErrorCode.TIMEOUT, "Timed out", {
        completedSections: ["industryMarket", "icpAnalysis"],
      });

      // Assert
      expect(response.error.completedSections).toEqual([
        "industryMarket",
        "icpAnalysis",
      ]);
    });

    it("preserves error code enum value exactly", () => {
      // Act
      const response = createErrorResponse(
        ErrorCode.PARSE_ERROR,
        "Parse error"
      );

      // Assert
      expect(response.error.code).toBe(ErrorCode.PARSE_ERROR);
      expect(response.error.code).toBe("PARSE_ERROR");
    });

    describe("retryability", () => {
      it.each([
        [ErrorCode.TIMEOUT, true],
        [ErrorCode.RATE_LIMITED, true],
        [ErrorCode.CIRCUIT_OPEN, true],
        [ErrorCode.VALIDATION_FAILED, false],
        [ErrorCode.PARSE_ERROR, false],
        [ErrorCode.API_ERROR, false],
        [ErrorCode.INVALID_INPUT, false],
        [ErrorCode.INTERNAL_ERROR, false],
      ])("ErrorCode.%s has retryable=%s", (code, expectedRetryable) => {
        const response = createErrorResponse(code, "Test message");
        expect(response.error.retryable).toBe(expectedRetryable);
      });
    });
  });

  describe("mapFailureReasonToCode", () => {
    it.each<[FailureReason | undefined, ErrorCode]>([
      ["timeout", ErrorCode.TIMEOUT],
      ["circuit_open", ErrorCode.CIRCUIT_OPEN],
      ["validation", ErrorCode.VALIDATION_FAILED],
      ["api_error", ErrorCode.API_ERROR],
      ["unknown", ErrorCode.INTERNAL_ERROR],
      [undefined, ErrorCode.INTERNAL_ERROR],
    ])("maps '%s' to %s", (reason, expectedCode) => {
      const result = mapFailureReasonToCode(reason);
      expect(result).toBe(expectedCode);
    });

    it("defaults unknown strings to INTERNAL_ERROR", () => {
      // @ts-expect-error testing invalid input
      const result = mapFailureReasonToCode("some_random_reason");
      expect(result).toBe(ErrorCode.INTERNAL_ERROR);
    });
  });

  describe("getHttpStatusForCode", () => {
    it.each<[ErrorCode, number]>([
      [ErrorCode.INVALID_INPUT, 400],
      [ErrorCode.TIMEOUT, 503],
      [ErrorCode.RATE_LIMITED, 503],
      [ErrorCode.CIRCUIT_OPEN, 503],
      [ErrorCode.VALIDATION_FAILED, 502],
      [ErrorCode.PARSE_ERROR, 502],
      [ErrorCode.API_ERROR, 502],
      [ErrorCode.INTERNAL_ERROR, 500],
    ])("ErrorCode.%s maps to HTTP %d", (code, expectedStatus) => {
      const result = getHttpStatusForCode(code);
      expect(result).toBe(expectedStatus);
    });

    it("defaults unknown codes to 500", () => {
      // @ts-expect-error testing invalid input
      const result = getHttpStatusForCode("UNKNOWN_CODE");
      expect(result).toBe(500);
    });
  });
});

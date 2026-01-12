import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateEnv, getEnv, getRequiredEnv, hasEnv } from "../env";

describe("env.ts", () => {
  // Store original env to restore after tests
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env to a clean state before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env after each test
    process.env = originalEnv;
  });

  describe("validateEnv", () => {
    it("returns valid: true when all required vars are present", () => {
      // Arrange: Set all required environment variables
      process.env.OPENROUTER_API_KEY = "test-openrouter-key";
      process.env.SEARCHAPI_KEY = "test-searchapi-key";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"; // optional but set

      // Act
      const result = validateEnv();

      // Assert
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it("returns valid: false with missing server vars listed", () => {
      // Arrange: Missing OPENROUTER_API_KEY and SEARCHAPI_KEY
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.SEARCHAPI_KEY;

      // Act
      const result = validateEnv();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.missing).toContain("OPENROUTER_API_KEY");
      expect(result.missing).toContain("SEARCHAPI_KEY");
    });

    it("returns valid: false with missing public vars listed", () => {
      // Arrange: Missing NEXT_PUBLIC_* vars
      process.env.OPENROUTER_API_KEY = "test-key";
      process.env.SEARCHAPI_KEY = "test-key";
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Act
      const result = validateEnv();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.missing).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(result.missing).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    });

    it("treats empty strings as missing", () => {
      // Arrange: Set vars to empty strings
      process.env.OPENROUTER_API_KEY = "";
      process.env.SEARCHAPI_KEY = "   "; // whitespace only
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";

      // Act
      const result = validateEnv();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.missing).toContain("OPENROUTER_API_KEY");
      expect(result.missing).toContain("SEARCHAPI_KEY");
    });

    it("includes warnings for missing optional vars", () => {
      // Arrange: All required present, optional missing
      process.env.OPENROUTER_API_KEY = "test-key";
      process.env.SEARCHAPI_KEY = "test-key";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
      delete process.env.NEXT_PUBLIC_APP_URL;

      // Act
      const result = validateEnv();

      // Assert
      expect(result.valid).toBe(true); // Still valid, just warnings
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("NEXT_PUBLIC_APP_URL");
    });
  });

  describe("getEnv", () => {
    it("returns undefined for missing vars", () => {
      // Arrange
      delete process.env.NONEXISTENT_VAR;

      // Act
      const result = getEnv("NONEXISTENT_VAR");

      // Assert
      expect(result).toBeUndefined();
    });

    it("returns value for present vars", () => {
      // Arrange
      process.env.TEST_VAR = "test-value";

      // Act
      const result = getEnv("TEST_VAR");

      // Assert
      expect(result).toBe("test-value");
    });

    it("returns undefined for empty string values", () => {
      // Arrange
      process.env.EMPTY_VAR = "";

      // Act
      const result = getEnv("EMPTY_VAR");

      // Assert
      expect(result).toBeUndefined();
    });

    it("returns undefined for whitespace-only values", () => {
      // Arrange
      process.env.WHITESPACE_VAR = "   ";

      // Act
      const result = getEnv("WHITESPACE_VAR");

      // Assert
      expect(result).toBeUndefined();
    });

    it("preserves values with leading/trailing spaces but content", () => {
      // Arrange
      process.env.SPACED_VAR = "  value  ";

      // Act
      const result = getEnv("SPACED_VAR");

      // Assert
      expect(result).toBe("  value  ");
    });
  });

  describe("getRequiredEnv", () => {
    it("returns value when var is present", () => {
      // Arrange
      process.env.REQUIRED_TEST = "required-value";

      // Act
      const result = getRequiredEnv("REQUIRED_TEST");

      // Assert
      expect(result).toBe("required-value");
    });

    it("throws when var is missing", () => {
      // Arrange
      delete process.env.MISSING_REQUIRED;

      // Act & Assert
      expect(() => getRequiredEnv("MISSING_REQUIRED")).toThrow();
    });

    it("throws when var is empty string", () => {
      // Arrange
      process.env.EMPTY_REQUIRED = "";

      // Act & Assert
      expect(() => getRequiredEnv("EMPTY_REQUIRED")).toThrow();
    });

    it("error message includes variable name", () => {
      // Arrange
      delete process.env.SPECIFIC_VAR_NAME;

      // Act & Assert
      expect(() => getRequiredEnv("SPECIFIC_VAR_NAME")).toThrow(
        /SPECIFIC_VAR_NAME/
      );
    });
  });

  describe("hasEnv", () => {
    it("returns false for missing vars", () => {
      // Arrange
      delete process.env.NONEXISTENT_HAS;

      // Act
      const result = hasEnv("NONEXISTENT_HAS");

      // Assert
      expect(result).toBe(false);
    });

    it("returns true for present vars", () => {
      // Arrange
      process.env.PRESENT_HAS = "some-value";

      // Act
      const result = hasEnv("PRESENT_HAS");

      // Assert
      expect(result).toBe(true);
    });

    it("returns false for empty string (considers var not effectively set)", () => {
      // Arrange
      process.env.EMPTY_HAS = "";

      // Act
      const result = hasEnv("EMPTY_HAS");

      // Assert
      // Based on implementation: hasEnv uses getEnv which returns undefined for empty
      expect(result).toBe(false);
    });

    it("returns false for whitespace-only values", () => {
      // Arrange
      process.env.WHITESPACE_HAS = "   ";

      // Act
      const result = hasEnv("WHITESPACE_HAS");

      // Assert
      expect(result).toBe(false);
    });
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  CircuitBreaker,
  CircuitOpenError,
  type CircuitState,
} from "../circuit-breaker";

describe("circuit-breaker.ts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("CircuitBreaker initialization", () => {
    it("starts in CLOSED state", () => {
      const breaker = new CircuitBreaker({ name: "test" });
      expect(breaker.getState()).toBe("CLOSED");
    });

    it("starts with failure count of 0", () => {
      const breaker = new CircuitBreaker({ name: "test" });
      expect(breaker.getFailureCount()).toBe(0);
    });

    it("accepts custom failureThreshold", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 5,
      });

      // Trip the circuit - need 5 failures
      for (let i = 0; i < 5; i++) {
        await breaker
          .execute(() => Promise.reject(new Error("fail")))
          .catch(() => {});
      }

      expect(breaker.getState()).toBe("OPEN");
    });

    it("accepts custom resetTimeout", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        resetTimeout: 5000, // 5 seconds
      });

      // Trip the circuit
      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getState()).toBe("OPEN");

      // Advance time by 3 seconds - should still be OPEN
      vi.advanceTimersByTime(3000);

      await expect(
        breaker.execute(() => Promise.resolve("test"))
      ).rejects.toThrow(CircuitOpenError);

      // Advance time to 5 seconds total - should transition to HALF_OPEN
      vi.advanceTimersByTime(2000);

      // Next call should attempt (HALF_OPEN allows one try)
      const result = await breaker.execute(() => Promise.resolve("success"));
      expect(result).toBe("success");
      expect(breaker.getState()).toBe("CLOSED");
    });
  });

  describe("execute() success handling", () => {
    it("returns result on success", async () => {
      const breaker = new CircuitBreaker({ name: "test" });

      const result = await breaker.execute(() => Promise.resolve("success"));

      expect(result).toBe("success");
    });

    it("resets failure count on success", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 3,
      });

      // Record 2 failures (not enough to trip)
      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getFailureCount()).toBe(2);

      // Success resets count
      await breaker.execute(() => Promise.resolve("success"));
      expect(breaker.getFailureCount()).toBe(0);
    });

    it("keeps state CLOSED on success", async () => {
      const breaker = new CircuitBreaker({ name: "test" });

      await breaker.execute(() => Promise.resolve("success"));

      expect(breaker.getState()).toBe("CLOSED");
    });
  });

  describe("execute() failure handling", () => {
    it("increments failure count on failure", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 5,
      });

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});

      expect(breaker.getFailureCount()).toBe(1);
    });

    it("re-throws the original error", async () => {
      const breaker = new CircuitBreaker({ name: "test" });
      const customError = new Error("Custom error message");

      await expect(breaker.execute(() => Promise.reject(customError))).rejects.toThrow(
        "Custom error message"
      );
    });

    it("opens circuit when threshold reached", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 3,
      });

      // First two failures - still CLOSED
      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getState()).toBe("CLOSED");

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getState()).toBe("CLOSED");

      // Third failure trips the circuit
      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getState()).toBe("OPEN");
    });
  });

  describe("CircuitOpenError", () => {
    it("is thrown when circuit is OPEN", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
      });

      // Trip the circuit
      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});

      // Next call should throw CircuitOpenError
      await expect(
        breaker.execute(() => Promise.resolve("test"))
      ).rejects.toThrow(CircuitOpenError);
    });

    it("contains circuit name", async () => {
      const breaker = new CircuitBreaker({
        name: "my-circuit",
        failureThreshold: 1,
      });

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});

      try {
        await breaker.execute(() => Promise.resolve("test"));
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenError);
        expect((error as CircuitOpenError).circuitName).toBe("my-circuit");
      }
    });

    it("contains next retry time", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        resetTimeout: 10000,
      });

      const now = Date.now();
      vi.setSystemTime(now);

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});

      try {
        await breaker.execute(() => Promise.resolve("test"));
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenError);
        const circuitError = error as CircuitOpenError;
        expect(circuitError.nextRetryAt.getTime()).toBe(now + 10000);
      }
    });
  });

  describe("State transitions", () => {
    it("CLOSED -> OPEN after failureThreshold failures", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 2,
      });

      expect(breaker.getState()).toBe("CLOSED");

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getState()).toBe("CLOSED");

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getState()).toBe("OPEN");
    });

    it("OPEN -> HALF_OPEN after resetTimeout elapsed", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        resetTimeout: 30000,
      });

      // Trip the circuit
      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getState()).toBe("OPEN");

      // Advance time past resetTimeout
      vi.advanceTimersByTime(30000);

      // The state check happens on next execute attempt
      // A successful execute will trigger HALF_OPEN -> CLOSED
      await breaker.execute(() => Promise.resolve("test"));
      expect(breaker.getState()).toBe("CLOSED");
    });

    it("HALF_OPEN -> CLOSED on success", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        resetTimeout: 1000,
      });

      // Trip the circuit
      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getState()).toBe("OPEN");

      // Wait for reset timeout
      vi.advanceTimersByTime(1000);

      // Success should close the circuit
      await breaker.execute(() => Promise.resolve("success"));
      expect(breaker.getState()).toBe("CLOSED");
      expect(breaker.getFailureCount()).toBe(0);
    });

    it("HALF_OPEN -> OPEN on failure", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        resetTimeout: 1000,
      });

      // Trip the circuit
      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getState()).toBe("OPEN");

      // Wait for reset timeout (transition to HALF_OPEN on next call)
      vi.advanceTimersByTime(1000);

      // Failure should re-open the circuit
      await breaker
        .execute(() => Promise.reject(new Error("fail again")))
        .catch(() => {});
      expect(breaker.getState()).toBe("OPEN");
    });
  });

  describe("getState()", () => {
    it("returns CLOSED for new circuit", () => {
      const breaker = new CircuitBreaker({ name: "test" });
      expect(breaker.getState()).toBe("CLOSED");
    });

    it("returns OPEN after tripping", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
      });

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getState()).toBe("OPEN");
    });
  });

  describe("reset()", () => {
    it("resets state to CLOSED", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
      });

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getState()).toBe("OPEN");

      breaker.reset();
      expect(breaker.getState()).toBe("CLOSED");
    });

    it("resets failure count to 0", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 5,
      });

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getFailureCount()).toBe(2);

      breaker.reset();
      expect(breaker.getFailureCount()).toBe(0);
    });

    it("allows requests after reset", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
      });

      // Trip the circuit
      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getState()).toBe("OPEN");

      // Reset and verify requests work
      breaker.reset();
      const result = await breaker.execute(() => Promise.resolve("success"));
      expect(result).toBe("success");
    });
  });

  describe("getFailureCount()", () => {
    it("returns 0 initially", () => {
      const breaker = new CircuitBreaker({ name: "test" });
      expect(breaker.getFailureCount()).toBe(0);
    });

    it("increments with each failure", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 10,
      });

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getFailureCount()).toBe(1);

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getFailureCount()).toBe(2);

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});
      expect(breaker.getFailureCount()).toBe(3);
    });
  });

  describe("edge cases", () => {
    it("handles async functions that throw", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 3,
      });

      const asyncThrower = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error("async error");
      };

      vi.useRealTimers(); // Need real timers for this test
      await expect(breaker.execute(asyncThrower)).rejects.toThrow("async error");
      expect(breaker.getFailureCount()).toBe(1);
      vi.useFakeTimers();
    });

    it("handles rapid successive calls", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 3,
      });

      // Fire multiple failures concurrently
      const promises = [
        breaker.execute(() => Promise.reject(new Error("1"))).catch(() => {}),
        breaker.execute(() => Promise.reject(new Error("2"))).catch(() => {}),
        breaker.execute(() => Promise.reject(new Error("3"))).catch(() => {}),
      ];

      await Promise.all(promises);

      // Should be OPEN after 3 failures
      expect(breaker.getState()).toBe("OPEN");
    });

    it("correctly calculates retry time in error message", async () => {
      const breaker = new CircuitBreaker({
        name: "test",
        failureThreshold: 1,
        resetTimeout: 60000, // 1 minute
      });

      const now = Date.now();
      vi.setSystemTime(now);

      await breaker
        .execute(() => Promise.reject(new Error("fail")))
        .catch(() => {});

      // Advance 30 seconds
      vi.advanceTimersByTime(30000);

      try {
        await breaker.execute(() => Promise.resolve("test"));
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenError);
        expect((error as CircuitOpenError).message).toContain("30s");
      }
    });
  });
});

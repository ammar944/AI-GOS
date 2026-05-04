import { afterEach, describe, expect, it } from "vitest";
import {
  dispatchGtmWorkerRun,
  dispatchGtmWorkerStage,
  getGtmWorkerUrl,
} from "@/lib/gtm/worker-dispatch";

const ORIGINAL_ENV = { ...process.env };

describe("GTM worker dispatch", () => {
  afterEach((): void => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("uses the local worker URL in development when no explicit URL is set", (): void => {
    delete process.env.AIGOS_GTM_WORKER_URL;
    delete process.env.RAILWAY_WORKER_URL;
    process.env.NODE_ENV = "development";

    expect(getGtmWorkerUrl()).toBe("http://localhost:3001");
  });

  it("throws an actionable error when the worker cannot be reached", async (): Promise<void> => {
    const originalFetch = global.fetch;
    delete process.env.AIGOS_GTM_WORKER_URL;
    delete process.env.RAILWAY_WORKER_URL;
    process.env.NODE_ENV = "development";

    try {
      global.fetch = (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch;

      await expect(
        dispatchGtmWorkerStage({
          runId: "run_test",
          userId: "user_test",
          inputUrl: "https://airtable.com/",
          stage: "discover-url",
        })
      ).rejects.toThrow(
        "GTM worker is unreachable at http://localhost:3001 while dispatching stage=discover-url run_id=run_test"
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("dispatches a full run without a stage so the worker owns Lighthouse orchestration", async (): Promise<void> => {
    const originalFetch = global.fetch;
    process.env.AIGOS_GTM_WORKER_URL = "https://worker.example.com/";
    delete process.env.RAILWAY_WORKER_URL;

    try {
      global.fetch = (async (_url, init) => {
        expect(JSON.parse(String(init?.body))).toEqual({
          run_id: "run_test",
          user_id: "user_test",
          input_url: "https://airtable.com/",
        });
        return new Response(JSON.stringify({ run_id: "run_test", status: "accepted" }), {
          status: 202,
        });
      }) as typeof fetch;

      await expect(
        dispatchGtmWorkerRun({
          runId: "run_test",
          userId: "user_test",
          inputUrl: "https://airtable.com/",
        })
      ).resolves.toEqual({
        run_id: "run_test",
        status: "accepted",
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});

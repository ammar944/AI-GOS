"use client";

import { useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CreateRunResponse {
  run_id: string;
  url: string;
}

export interface NewRunFormProps {
  onSubmit?: (inputUrl: string) => Promise<void> | void;
}

export function NewRunForm({ onSubmit }: NewRunFormProps): ReactElement {
  const router = useRouter();
  const [inputUrl, setInputUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const normalizedUrl = normalizeInputUrl(inputUrl);

    if (!normalizedUrl) {
      setError("Enter a valid http or https URL.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      if (onSubmit) {
        await onSubmit(normalizedUrl);
        return;
      }

      const run = await createRun(normalizedUrl);
      router.push(`/gtm/${run.run_id}`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      aria-label="Create GTM run"
      className="flex flex-col gap-3"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Company URL"
          aria-invalid={Boolean(error)}
          disabled={submitting}
          inputMode="url"
          name="input_url"
          onChange={(event) => setInputUrl(event.target.value)}
          placeholder="https://airtable.com"
          type="url"
          value={inputUrl}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Start run"}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

async function createRun(inputUrl: string): Promise<CreateRunResponse> {
  const response = await fetch("/api/gtm/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input_url: inputUrl }),
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error(
      `Failed to create GTM run for ${inputUrl}: ${getPayloadMessage(payload)} (status ${response.status})`
    );
  }

  if (!isCreateRunResponse(payload)) {
    throw new Error(`Invalid create-run response for ${inputUrl}.`);
  }

  return payload;
}

function normalizeInputUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function isCreateRunResponse(value: unknown): value is CreateRunResponse {
  return (
    isRecord(value) &&
    typeof value.run_id === "string" &&
    typeof value.url === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPayloadMessage(payload: unknown): string {
  if (isRecord(payload) && typeof payload.message === "string") {
    return payload.message;
  }

  return "API returned an error without a message.";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

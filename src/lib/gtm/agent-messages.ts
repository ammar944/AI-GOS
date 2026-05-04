import { z } from "zod";

export const gtmAgentMessageRoleSchema = z.enum([
  "user",
  "assistant",
  "system",
  "tool",
]);

export const gtmAgentMessageTypeSchema = z.enum([
  "text",
  "thinking",
  "tool_group",
  "artifact",
  "error",
  "system",
]);

export const gtmAgentMessageStatusSchema = z.enum([
  "pending",
  "streaming",
  "complete",
  "errored",
]);

export const gtmAgentMessageSchema = z.object({
  id: z.string(),
  run_id: z.string().min(1),
  user_id: z.string().min(1),
  role: gtmAgentMessageRoleSchema,
  message_type: gtmAgentMessageTypeSchema,
  content: z.record(z.string(), z.unknown()),
  status: gtmAgentMessageStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(),
});

export const gtmAgentMessageInsertSchema = gtmAgentMessageSchema
  .omit({
    id: true,
    created_at: true,
  })
  .extend({
    created_at: z.string().datetime().optional(),
  });

export type GtmAgentMessageRole = z.infer<typeof gtmAgentMessageRoleSchema>;
export type GtmAgentMessageType = z.infer<typeof gtmAgentMessageTypeSchema>;
export type GtmAgentMessageStatus = z.infer<typeof gtmAgentMessageStatusSchema>;
export type GtmAgentMessage = z.infer<typeof gtmAgentMessageSchema>;
export type GtmAgentMessageInsert = z.infer<typeof gtmAgentMessageInsertSchema>;

export function validateGtmAgentMessageInsert(
  message: GtmAgentMessageInsert,
): GtmAgentMessageInsert {
  return gtmAgentMessageInsertSchema.parse(message);
}

export function getGtmAgentMessageText(message: GtmAgentMessage): string {
  const text = message.content.text;
  return typeof text === "string" ? text : "";
}

export function getGtmAgentMessageDisplayText(
  message: GtmAgentMessage,
): string {
  const text = getGtmAgentMessageText(message).trim();
  if (text.length > 0) {
    return text;
  }

  if (message.message_type === "tool_group") {
    return getToolGroupDisplayText(message.content);
  }

  return "";
}

export function isMissingGtmMessagesTableError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  const code = getStringField(error, "code").toLowerCase();
  const message = getStringField(error, "message").toLowerCase();
  const details = getStringField(error, "details").toLowerCase();
  const hint = getStringField(error, "hint").toLowerCase();
  const text = `${code} ${message} ${details} ${hint}`;

  const mentionsGtmMessages =
    text.includes("gtm_messages") || text.includes("public.gtm_messages");
  const isMissingTableError =
    code === "pgrst205" ||
    code === "42p01" ||
    text.includes("schema cache") ||
    text.includes("could not find the table") ||
    (text.includes("relation") && text.includes("does not exist"));

  return mentionsGtmMessages && isMissingTableError;
}

function getToolGroupDisplayText(content: Record<string, unknown>): string {
  const label = getStringField(content, "label");
  const stage = getStringField(content, "stage");
  const status = getStringField(content, "status");

  if (label && stage && status) {
    return `${label} ${status} for ${stage}.`;
  }

  if (label && status) {
    return `${label} ${status}.`;
  }

  if (stage && status) {
    return `${stage} ${status}.`;
  }

  return "";
}

function getStringField(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

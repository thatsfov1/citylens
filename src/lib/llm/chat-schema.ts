import { z } from "zod";
import { CATEGORIES, EDUCATION_STAGES } from "../../types";
import type { Anchor } from "../scoring/anchor";
import { importanceSchema, snapImportance } from "../scoring/preferences";

export const MAX_MESSAGES = 12;
export const MAX_MESSAGE_CHARS = 500;

export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES)
    // Gemini needs the conversation to end on the user's turn.
    .refine((m) => m.at(-1)?.role === "user", "last message must be from the user"),
});

export type ChatMessage = z.infer<typeof chatRequestSchema>["messages"][number];

/** What the model must return: a reply, plus weights once it has enough information. */
export const chatOutputSchema = z.object({
  reply: z.string().min(1).max(600),
  importance: importanceSchema.nullable(),
  /** Education life stages the user mentioned (e.g. a toddler → kindergarten); null when none were mentioned. */
  stages: z.array(z.enum(EDUCATION_STAGES)).nullable(),
  /** Categories the user explicitly wants LESS of (quiet, few shops…); null/absent when none. */
  avoid: z.array(z.enum(CATEGORIES)).nullish(),
  /** A place the user wants to be near, copied as they wrote it; the server resolves it from data. Null when none. */
  nearPlace: z
    .object({
      query: z.string().trim().min(2).max(80),
      radiusM: z.union([z.literal(500), z.literal(1000), z.literal(1500), z.literal(2000)]),
    })
    .nullish(),
});

export type ChatOutput = z.infer<typeof chatOutputSchema>;

/** What `/api/chat` returns: the model output with the place resolved to coordinates (or dropped). */
export type ChatResult = Omit<ChatOutput, "nearPlace"> & { anchor: Anchor | null };

/** JSON schema handed to Gemini for structured output. */
export const chatOutputJsonSchema = z.toJSONSchema(chatOutputSchema);

/** Parses raw model text into a validated result; throws if it isn't valid. */
export function parseChatOutput(raw: string): ChatOutput {
  const parsed = chatOutputSchema.parse(JSON.parse(raw));
  if (!parsed.importance) return parsed;
  const rounded = Object.fromEntries(
    Object.entries(parsed.importance).map(([k, v]) => [k, snapImportance(v)]),
  ) as ChatOutput["importance"];
  return { ...parsed, importance: rounded };
}

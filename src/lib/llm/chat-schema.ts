import { z } from "zod";
import { importanceSchema } from "../scoring/preferences";

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
});

export type ChatResult = z.infer<typeof chatOutputSchema>;

/** JSON schema handed to Gemini for structured output. */
export const chatOutputJsonSchema = z.toJSONSchema(chatOutputSchema);

/** Parses raw model text into a validated result; throws if it isn't valid. */
export function parseChatOutput(raw: string): ChatResult {
  const parsed = chatOutputSchema.parse(JSON.parse(raw));
  if (!parsed.importance) return parsed;
  const rounded = Object.fromEntries(
    Object.entries(parsed.importance).map(([k, v]) => [k, Math.round(v / 5) * 5]),
  ) as ChatResult["importance"];
  return { ...parsed, importance: rounded };
}

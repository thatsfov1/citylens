import { z } from "zod";
import { EDUCATION_STAGES } from "../../types";
import type { Anchor } from "../scoring/anchor";
import type { RentFilter } from "../scoring/rent";
import { TRAVEL_MODES, type Workplace } from "../scoring/commute";
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
  /** A place the user wants to be near, copied as they wrote it; the server resolves it from data. Null when none. */
  nearPlace: z
    .object({
      query: z.string().trim().min(2).max(80),
      radiusM: z.union([z.literal(500), z.literal(1000), z.literal(1500), z.literal(2000)]),
    })
    .nullish(),
  /** A monthly rent budget in PLN the user stated, copied as written (null fields = no limit on that side); null when none. */
  budget: z
    .object({
      min: z.number().int().min(0).max(100000).nullable(),
      max: z.number().int().min(0).max(100000).nullable(),
      rooms: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
    })
    .nullish(),
  /** Where the user works and how they travel, copied as written (null fields = not stated); null when no workplace. */
  workplace: z
    .object({
      query: z.string().trim().min(2).max(80),
      mode: z.enum(TRAVEL_MODES).nullable(),
      maxMin: z.number().int().min(5).max(120).nullable(),
    })
    .nullish(),
});

export type ChatOutput = z.infer<typeof chatOutputSchema>;

/** What `/api/chat` returns: the model output with the place resolved to coordinates (or dropped). */
export type ChatResult = Omit<ChatOutput, "nearPlace" | "budget" | "workplace"> & {
  anchor: Anchor | null;
  rent: RentFilter | null;
  work: Workplace | null;
};

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

// Server function: AI cleanup of a raw field-dictated finding description.

import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const CleanupInput = z.object({
  raw: z.string().min(1).max(4000),
  type: z.string().max(120).optional(),
  location: z.string().max(40).optional(),
});

const SYSTEM_PROMPT = `You clean up dictated field-survey descriptions for a structural engineer's report.

Hard rules:
- Keep the engineer's voice and intent. Do not add facts that are not in the input.
- Do not speculate about cause or severity. Do not assign judgement.
- Fix obvious dictation/transcription errors ("stair step" -> "stairstep crack", "horiztonal" -> "horizontal", "the the" -> "the").
- Normalize common construction terminology only when meaning is unambiguous.
- Keep it concise: at most 3 sentences, plain prose, no bullets, no headings, no markdown.
- Output ONLY the cleaned description. No preamble, no quotes, no commentary.`;

export const cleanupDescription = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CleanupInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      throw new Error("AI is unavailable: LOVABLE_API_KEY not configured.");
    }

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const userPrompt =
      `Location: ${data.location ?? "—"}\n` +
      `Type: ${data.type ?? "—"}\n` +
      `Raw dictated description:\n${data.raw}`;

    try {
      const { text } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
      });
      const cleaned = text.trim().replace(/^["']+|["']+$/g, "");
      return { cleaned };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Surface gateway billing/rate errors clearly to the UI.
      if (/\b429\b/.test(msg)) {
        throw new Error("AI is rate-limited. Wait a moment and try again.");
      }
      if (/\b402\b/.test(msg)) {
        throw new Error(
          "AI credits exhausted. Add credits in Workspace → Usage to continue.",
        );
      }
      throw new Error(`AI cleanup failed: ${msg}`);
    }
  });

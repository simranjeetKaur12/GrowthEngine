import { z } from "zod";

import { env } from "../config";

type StructuredGenerationOptions<T> = {
  model: string;
  schemaName: string;
  schema: Record<string, unknown>;
  parser: z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  retries?: number;
};

function getApiKey() {
  const key = env.openAiApiKey;
  if (!key) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return key;
}

function extractAssistantText(payload: any): string {
  const choice = payload?.choices?.[0];
  if (!choice) {
    throw new Error("OpenAI response contained no choices");
  }

  const content = choice?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textPart = content.find((part) => part?.type === "text");
    if (textPart?.text) {
      return textPart.text;
    }
  }

  throw new Error("Unable to extract assistant JSON content");
}

export async function generateStructuredJson<T>(
  options: StructuredGenerationOptions<T>
): Promise<T> {
  const retries = options.retries ?? 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${env.openAiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApiKey()}`
        },
        body: JSON.stringify({
          model: options.model,
          temperature: 0.2,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: options.schemaName,
              strict: true,
              schema: options.schema
            }
          },
          messages: [
            { role: "system", content: options.systemPrompt },
            {
              role: "user",
              content:
                attempt === 0
                  ? options.userPrompt
                  : `${options.userPrompt}\n\nIMPORTANT: previous output failed validation. Return strictly valid JSON matching schema.`
            }
          ]
        })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`OpenAI request failed (${response.status}): ${message}`);
      }

      const payload = await response.json();
      const raw = extractAssistantText(payload);
      const parsed = JSON.parse(raw) as unknown;
      return options.parser.parse(parsed);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown OpenAI error");
    }
  }

  throw new Error(`Structured generation failed: ${lastError?.message ?? "Unknown error"}`);
}

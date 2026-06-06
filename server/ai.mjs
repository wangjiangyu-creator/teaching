const NOTE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    researchArgument: { type: "string" },
    teachingUses: {
      type: "array",
      items: { type: "string" }
    },
    researchThemes: {
      type: "array",
      items: { type: "string" }
    },
    classroomPrompt: { type: "string" },
    caution: { type: "string" }
  },
  required: ["researchArgument", "teachingUses", "researchThemes", "classroomPrompt", "caution"]
};

function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const chunks = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

export function createAiService({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL || "gpt-4.1-mini",
  fetchImpl = fetch
} = {}) {
  if (!apiKey) {
    return { configured: false, generateDraft: undefined };
  }

  return {
    configured: true,
    async generateDraft(source) {
      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          instructions: [
            "You are helping curate a private research workspace on legal education, AI, geopolitics, Chinese law, comparative law, and international law.",
            "Return a cautious source-linked research note. Do not invent bibliographic facts. If the source text is thin, say what can and cannot be inferred.",
            "Use teaching-use IDs only from this set: legal-education-history, comparative-law-seminar, ai-and-law-pedagogy, geopolitics-rule-of-law, international-law-context, curriculum-design, professional-ethics-skills, taiwan-hong-kong-comparison, china-law-theory, research-methods, method-exemplars."
          ].join("\n"),
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: JSON.stringify({
                    title: source.title,
                    language: source.language,
                    jurisdictions: source.jurisdictions,
                    existingTeachingUses: source.teachingUses,
                    existingResearchThemes: source.researchThemes,
                    textPreview: source.textPreview,
                    driveUrl: source.driveUrl
                  })
                }
              ]
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "curation_note",
              schema: NOTE_SCHEMA,
              strict: true
            }
          }
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenAI request failed: ${response.status} ${body.slice(0, 240)}`);
      }

      const body = await response.json();
      const text = outputText(body);
      if (!text) throw new Error("OpenAI response did not include output text.");
      return JSON.parse(text);
    }
  };
}

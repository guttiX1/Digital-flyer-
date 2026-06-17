import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../db/client.js";
import type { DesignStyle } from "../types.js";
import path from "path";
import fs from "fs";

const client = new Anthropic();

interface GenerateDesignParams {
  topic: string;
  style: DesignStyle;
  product_types: string[];
  trend_id?: number;
  extra_context?: string;
}

interface DesignResult {
  design_id: number;
  name: string;
  brief: string;
  image_prompt: string;
  style_notes: string;
  colors: string[];
  typography: string;
  status: "brief_ready";
  next_step: string;
}

const STYLE_DESCRIPTIONS: Record<DesignStyle, string> = {
  vintage_western:
    "Aged, worn look. Sepia tones with gold highlights. Ranch and rodeo heritage. Serif display fonts with distress texture.",
  distressed_racing:
    "High-energy race track feel. Bold fonts with cracks and wear. Black/gold/white palette. Speed lines and dust.",
  bold_emblem:
    "Shield or badge-style logo. Symmetrical. Strong heraldic vibes. Works great on hats and chest prints.",
  ranch_luxury:
    "Premium ranch aesthetic. Clean lines with subtle texture. Leather and rope motifs. Dark navy or black base.",
  champion_stallion:
    "Majestic horse as centerpiece. Dynamic pose. Metallic gold treatment. 'Champion' energy — earned, not given.",
  carril_culture:
    "Authentically local carril culture. References real carril names, slang, the community. Raw and real.",
};

export async function generateDesign(
  params: GenerateDesignParams
): Promise<DesignResult> {
  const db = getDb();
  const styleDesc = STYLE_DESCRIPTIONS[params.style];

  const systemPrompt = `You are a POD merch designer specializing in Mexican and Latino horse racing culture (carreras de caballos).
You create designs that resonate deeply with the community — cuadras, caballos, carril culture, rivalries, pride.
Your designs are authentic, not generic. They feel like they came from someone who lives the sport.`;

  const userPrompt = `Create a detailed print-on-demand design brief for: "${params.topic}"

Style: ${params.style} — ${styleDesc}
Products: ${params.product_types.join(", ")}
${params.extra_context ? `Context: ${params.extra_context}` : ""}

Return a JSON object with:
{
  "name": "short design name (3-5 words)",
  "tagline": "1-line hype copy in Spanish or Spanglish",
  "brief": "2-3 sentence design description for a designer",
  "image_prompt": "detailed Midjourney/FLUX prompt for the main graphic (no text in image)",
  "style_notes": "specific execution notes for this style",
  "colors": ["hex1", "hex2", "hex3"],
  "typography": "font direction (e.g., 'distressed serif display, all caps, compressed')",
  "layout": "how the elements are arranged on the garment"
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON in design brief");

  const parsed = JSON.parse(jsonMatch[0]);

  const ensureDesignsDir = () => {
    const dir = process.env.DESIGNS_DIR ?? path.resolve("../output/designs");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  };
  ensureDesignsDir();

  const result = db
    .prepare(
      `INSERT INTO designs (name, trend_id, style, brief, is_personal, status)
       VALUES (?, ?, ?, ?, 0, 'brief')
       RETURNING *`
    )
    .get(
      parsed.name,
      params.trend_id ?? null,
      params.style,
      JSON.stringify(parsed)
    ) as { id: number; name: string };

  return {
    design_id: result.id,
    name: parsed.name,
    brief: parsed.brief,
    image_prompt: parsed.image_prompt,
    style_notes: parsed.style_notes,
    colors: parsed.colors,
    typography: parsed.typography,
    status: "brief_ready",
    next_step: `Brief saved (design_id: ${result.id}). To generate the image, run it through Kittl or paste image_prompt into FLUX/Midjourney. Then call publish_printify with the design_id and image path.`,
  };
}

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getTrends, upsertTrend } from "./tools/get-trends.js";
import { scoreTopic } from "./tools/score-topic.js";
import { generateDesign } from "./tools/generate-design.js";
import { publishPrintify } from "./tools/publish-printify.js";
import { listEtsy } from "./tools/list-etsy.js";
import { getSales } from "./tools/get-sales.js";
import { dropPersonal } from "./tools/drop-personal.js";

const server = new McpServer({
  name: "carrerasos",
  version: "0.1.0",
});

// ─── get_trends ─────────────────────────────────────────────────────────────

server.tool(
  "get_trends",
  "Get top trending horses, cuadras, and phrases from the community data. Run this first to see what's hot.",
  {
    limit: z.number().optional().default(10).describe("How many trends to return"),
    type: z
      .enum(["horse", "cuadra", "phrase", "event", "all"])
      .optional()
      .default("all")
      .describe("Filter by trend type"),
    days: z.number().optional().default(7).describe("Look-back window in days"),
  },
  async ({ limit, type, days }) => {
    const result = getTrends({ limit: limit ?? 10, type: type ?? "all", days: days ?? 7 });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── seed_trend (manual entry) ───────────────────────────────────────────────

server.tool(
  "seed_trend",
  "Manually seed a trend you've spotted in the community. Use when you've seen a horse or cuadra blowing up in groups.",
  {
    topic: z.string().describe("Horse name, cuadra, or phrase"),
    type: z.enum(["horse", "cuadra", "phrase", "event"]).describe("What kind of trend"),
    mentions: z.number().describe("Approximate mention count you've observed"),
    growth_pct: z.number().optional().default(0).describe("Estimated growth % vs last week"),
    sentiment: z
      .enum(["positive", "neutral", "hype"])
      .optional()
      .default("positive")
      .describe("Community vibe around this topic"),
  },
  async ({ topic, type, mentions, growth_pct, sentiment }) => {
    const result = upsertTrend(topic, type, mentions, growth_pct ?? 0, sentiment ?? "positive");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { message: `Trend "${topic}" seeded with score ${result.score}`, trend: result },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── score_topic ─────────────────────────────────────────────────────────────

server.tool(
  "score_topic",
  "Score a specific horse, cuadra, or phrase to see if it's worth making merch for right now.",
  {
    topic: z.string().describe("The horse name, cuadra, or phrase to score"),
  },
  async ({ topic }) => {
    const result = scoreTopic(topic);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── generate_design ─────────────────────────────────────────────────────────

server.tool(
  "generate_design",
  "Generate a design brief for a topic. Returns the concept, image prompt for Kittl/FLUX, and saves to DB.",
  {
    topic: z.string().describe("Horse name, cuadra, phrase, or event to design around"),
    style: z
      .enum([
        "vintage_western",
        "distressed_racing",
        "bold_emblem",
        "ranch_luxury",
        "champion_stallion",
        "carril_culture",
      ])
      .describe("Visual style direction"),
    product_types: z
      .array(z.string())
      .describe("Products to design for, e.g. ['shirt', 'hoodie', 'hat']"),
    trend_id: z.number().optional().describe("Link to a trend ID if this came from trend data"),
    extra_context: z
      .string()
      .optional()
      .describe("Any cultural context or specific angle you want in the design"),
  },
  async ({ topic, style, product_types, trend_id, extra_context }) => {
    const result = await generateDesign({ topic, style, product_types, trend_id, extra_context });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── drop_personal ────────────────────────────────────────────────────────────

server.tool(
  "drop_personal",
  "YOUR lane. Drop one of your own designs into the pipeline. Bypasses AI trend detection — goes straight from your image to publish.",
  {
    name: z.string().describe("Design name"),
    image_path: z.string().describe("Absolute path to your design image (PNG preferred, 4500x5400px for shirts)"),
    context: z
      .string()
      .describe(
        "Cultural context only YOU know — what this means to the community, what event/moment inspired it, why it hits"
      ),
    style: z.string().describe("Style label for reference (e.g. vintage_western, bold_emblem)"),
    product_types: z
      .array(z.string())
      .describe("Products to put this on: shirt, hoodie, hat, sticker, mug"),
    skip_to_publish: z
      .boolean()
      .optional()
      .default(false)
      .describe("If true, immediately queues for Printify publish"),
  },
  async ({ name, image_path, context, style, product_types, skip_to_publish }) => {
    const result = dropPersonal({ name, image_path, context, style, product_types, skip_to_publish });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── publish_printify ────────────────────────────────────────────────────────

server.tool(
  "publish_printify",
  "Push a design to Printify and create products. Works with both AI-generated and personal designs.",
  {
    design_id: z.number().describe("Design ID from generate_design or drop_personal"),
    product_types: z
      .array(z.string())
      .describe("Product types to create: shirt, hoodie, hat, sticker, mug"),
    image_path: z
      .string()
      .optional()
      .describe("Override image path if different from what's in the DB"),
  },
  async ({ design_id, product_types, image_path }) => {
    const result = await publishPrintify({ design_id, product_types, image_path });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── list_etsy ────────────────────────────────────────────────────────────────

server.tool(
  "list_etsy",
  "Generate SEO-optimized listing copy with Claude and publish products to your Etsy store.",
  {
    product_ids: z
      .array(z.number())
      .describe("Product IDs from publish_printify to list on Etsy"),
    price: z.number().optional().default(29.99).describe("Listing price in USD"),
    shipping_profile_id: z
      .number()
      .optional()
      .describe("Etsy shipping profile ID (get from your Etsy shop settings)"),
  },
  async ({ product_ids, price, shipping_profile_id }) => {
    const result = await listEtsy({ product_ids, price, shipping_profile_id });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── get_sales ────────────────────────────────────────────────────────────────

server.tool(
  "get_sales",
  "See what's selling, what's not, and what to make more of. The feedback loop.",
  {
    days: z.number().optional().default(30).describe("Look-back period in days"),
    limit: z.number().optional().default(10).describe("Number of top sellers to show"),
  },
  async ({ days, limit }) => {
    const result = getSales({ days, limit });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

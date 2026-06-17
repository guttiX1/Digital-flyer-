import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../db/client.js";

interface ListEtsyParams {
  product_ids: number[];
  price?: number;
  shipping_profile_id?: number;
}

interface EtsyListing {
  product_id: number;
  product_type: string;
  listing_id: number;
  etsy_listing_id: string | null;
  title: string;
  tags: string[];
  price: number;
  status: string;
}

interface ListEtsyResult {
  listings: EtsyListing[];
  store_url: string | null;
  note: string;
}

const client = new Anthropic();

export async function listEtsy(params: ListEtsyParams): Promise<ListEtsyResult> {
  const db = getDb();
  const listings: EtsyListing[] = [];
  const shopId = process.env.ETSY_SHOP_ID;
  const accessToken = process.env.ETSY_ACCESS_TOKEN;
  const apiKey = process.env.ETSY_API_KEY;
  const price = params.price ?? 29.99;

  for (const productId of params.product_ids) {
    const product = db
      .prepare(
        `SELECT mp.*, d.name, d.brief, d.personal_context, d.style
         FROM merch_products mp
         JOIN designs d ON mp.design_id = d.id
         WHERE mp.id = ?`
      )
      .get(productId) as
      | {
          id: number;
          product_type: string;
          name: string;
          brief: string;
          personal_context: string | null;
          style: string;
          printify_product_id: string | null;
        }
      | undefined;

    if (!product) continue;

    let briefObj: Record<string, string> = {};
    try { briefObj = JSON.parse(product.brief); } catch { briefObj = { name: product.name }; }

    const copy = await generateListingCopy(
      product.name,
      product.product_type,
      product.style,
      briefObj,
      product.personal_context
    );

    let etsyListingId: string | null = null;

    if (accessToken && apiKey && shopId && product.printify_product_id) {
      try {
        const res = await fetch(
          `https://openapi.etsy.com/v3/application/shops/${shopId}/listings`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              quantity: 999,
              title: copy.title,
              description: copy.description,
              price: price,
              who_made: "i_did",
              when_made: "made_to_order",
              taxonomy_id: 1803,
              tags: copy.tags.slice(0, 13),
              shipping_profile_id: params.shipping_profile_id,
            }),
          }
        );
        const data = (await res.json()) as { listing_id: number };
        etsyListingId = String(data.listing_id);
      } catch (err) {
        console.error("Etsy API error:", err);
      }
    }

    const row = db
      .prepare(
        `INSERT INTO merch_listings (product_id, etsy_listing_id, title, description, tags, price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         RETURNING id`
      )
      .get(
        productId,
        etsyListingId,
        copy.title,
        copy.description,
        copy.tags.join(","),
        price,
        etsyListingId ? "active" : "draft"
      ) as { id: number };

    listings.push({
      product_id: productId,
      product_type: product.product_type,
      listing_id: row.id,
      etsy_listing_id: etsyListingId,
      title: copy.title,
      tags: copy.tags,
      price,
      status: etsyListingId ? "live on Etsy" : "draft (no Etsy token)",
    });
  }

  return {
    listings,
    store_url: shopId ? `https://www.etsy.com/shop/${shopId}` : null,
    note: accessToken
      ? `${listings.length} listing(s) created on Etsy.`
      : `Etsy tokens not set — listings saved as drafts with full copy. Add ETSY_ACCESS_TOKEN and ETSY_SHOP_ID to .env to go live.`,
  };
}

async function generateListingCopy(
  name: string,
  productType: string,
  style: string,
  brief: Record<string, string>,
  personalContext: string | null
): Promise<{ title: string; description: string; tags: string[] }> {
  const prompt = `Write an Etsy listing for a horse racing (carreras de caballos) merch item.

Product: ${productType} — "${name}"
Style: ${style}
Design tagline: ${brief.tagline ?? ""}
Design brief: ${brief.brief ?? ""}
${personalContext ? `Cultural context: ${personalContext}` : ""}

Return JSON:
{
  "title": "SEO-optimized Etsy title under 140 chars, include relevant keywords",
  "description": "3-paragraph Etsy description (150-250 words). Paragraph 1: product/design story. Paragraph 2: product details. Paragraph 3: care instructions + CTA.",
  "tags": ["array", "of", "13", "etsy", "tags", "max", "20", "chars", "each"]
}

Rules: Bilingual is great (Spanglish). Mention the horse racing culture authentically. Include size/fit info for apparel.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Failed to parse listing copy from Claude");

  const parsed = JSON.parse(match[0]);
  return {
    title: parsed.title ?? name,
    description: parsed.description ?? "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 13) : [],
  };
}

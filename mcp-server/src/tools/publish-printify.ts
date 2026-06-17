import { getDb } from "../db/client.js";
import fs from "fs";

interface PublishPrintifyParams {
  design_id: number;
  product_types: string[];
  image_path?: string;
}

interface PrintifyProduct {
  product_type: string;
  printify_product_id: string | null;
  mockup_url: string | null;
  status: string;
  db_id: number;
}

interface PublishResult {
  design_id: number;
  products: PrintifyProduct[];
  ready_for_etsy: boolean;
  note: string;
}

const PRODUCT_BLUEPRINTS: Record<string, { blueprint_id: number; label: string }> = {
  shirt:   { blueprint_id: 6,   label: "Unisex Heavy Cotton Tee" },
  hoodie:  { blueprint_id: 92,  label: "Unisex Heavy Blend Hoodie" },
  hat:     { blueprint_id: 68,  label: "Structured Twill Cap" },
  sticker: { blueprint_id: 370, label: "Kiss-Cut Sticker" },
  mug:     { blueprint_id: 159, label: "White Glossy Mug" },
};

export async function publishPrintify(
  params: PublishPrintifyParams
): Promise<PublishResult> {
  const db = getDb();

  const design = db
    .prepare("SELECT * FROM designs WHERE id = ?")
    .get(params.design_id) as
    | { id: number; name: string; image_path: string | null; brief: string }
    | undefined;

  if (!design) throw new Error(`Design #${params.design_id} not found.`);

  const imagePath = params.image_path ?? design.image_path;
  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error(
      `No image found for design #${params.design_id}.\n` +
      `Either pass image_path or make sure the design has one saved.\n` +
      `Current path: ${imagePath}`
    );
  }

  const apiKey = process.env.PRINTIFY_API_KEY;
  const shopId = process.env.PRINTIFY_SHOP_ID;
  const products: PrintifyProduct[] = [];

  for (const ptype of params.product_types) {
    const blueprint = PRODUCT_BLUEPRINTS[ptype];
    if (!blueprint) {
      products.push({
        product_type: ptype,
        printify_product_id: null,
        mockup_url: null,
        status: `skipped — unknown product type "${ptype}"`,
        db_id: -1,
      });
      continue;
    }

    let printifyId: string | null = null;
    let mockupUrl: string | null = null;

    if (apiKey && shopId) {
      try {
        const uploadRes = await fetch("https://api.printify.com/v1/uploads/images.json", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            file_name: `${design.name.replace(/\s+/g, "_")}.png`,
            contents: fs.readFileSync(imagePath).toString("base64"),
          }),
        });
        const uploadData = (await uploadRes.json()) as { id: string };

        const productRes = await fetch(
          `https://api.printify.com/v1/shops/${shopId}/products.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              title: design.name,
              blueprint_id: blueprint.blueprint_id,
              print_provider_id: 1,
              variants: [],
              print_areas: [
                {
                  variant_ids: [],
                  placeholders: [
                    { position: "front", images: [{ id: uploadData.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
                  ],
                },
              ],
            }),
          }
        );
        const productData = (await productRes.json()) as { id: string; images?: { src: string }[] };
        printifyId = productData.id;
        mockupUrl = productData.images?.[0]?.src ?? null;
      } catch (err) {
        console.error(`Printify API error for ${ptype}:`, err);
      }
    }

    const row = db
      .prepare(
        `INSERT INTO merch_products (design_id, printify_product_id, product_type, mockup_url, status)
         VALUES (?, ?, ?, ?, ?)
         RETURNING id`
      )
      .get(
        params.design_id,
        printifyId,
        ptype,
        mockupUrl,
        printifyId ? "published" : "draft"
      ) as { id: number };

    products.push({
      product_type: ptype,
      printify_product_id: printifyId,
      mockup_url: mockupUrl,
      status: printifyId ? "published to Printify" : "saved as draft (no API key)",
      db_id: row.id,
    });
  }

  db.prepare("UPDATE designs SET status = 'published' WHERE id = ?").run(params.design_id);

  const productIds = products.map((p) => p.db_id).filter((id) => id > 0);

  return {
    design_id: params.design_id,
    products,
    ready_for_etsy: productIds.length > 0,
    note: apiKey
      ? `${products.length} product(s) pushed to Printify. Call list_etsy with product_ids: [${productIds.join(", ")}]`
      : `PRINTIFY_API_KEY not set — products saved as drafts. Add key to .env and re-run to push live.`,
  };
}

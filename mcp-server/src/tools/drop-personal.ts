import { getDb } from "../db/client.js";
import fs from "fs";
import path from "path";

interface DropPersonalParams {
  name: string;
  image_path: string;
  context: string;
  style: string;
  product_types: string[];
  skip_to_publish?: boolean;
}

interface DropResult {
  design_id: number;
  name: string;
  status: string;
  message: string;
  next_step: string;
}

export function dropPersonal(params: DropPersonalParams): DropResult {
  const db = getDb();

  if (!fs.existsSync(params.image_path)) {
    throw new Error(
      `Image not found at: ${params.image_path}\nMake sure the file exists before dropping.`
    );
  }

  const outputDir = process.env.DESIGNS_DIR ?? path.resolve("../output/designs");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const ext = path.extname(params.image_path);
  const slug = params.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const destFilename = `personal-${slug}-${Date.now()}${ext}`;
  const destPath = path.join(outputDir, destFilename);
  fs.copyFileSync(params.image_path, destPath);

  const brief = JSON.stringify({
    name: params.name,
    context: params.context,
    style: params.style,
    product_types: params.product_types,
    source: "personal_drop",
  });

  const result = db
    .prepare(
      `INSERT INTO designs (name, trend_id, style, brief, image_path, is_personal, personal_context, status)
       VALUES (?, NULL, ?, ?, ?, 1, ?, 'generated')
       RETURNING *`
    )
    .get(
      params.name,
      params.style,
      brief,
      destPath,
      params.context
    ) as { id: number };

  const message = params.skip_to_publish
    ? `Personal design "${params.name}" dropped and queued for publish.`
    : `Personal design "${params.name}" dropped. Image saved to ${destPath}. Ready to publish.`;

  return {
    design_id: result.id,
    name: params.name,
    status: "generated",
    message,
    next_step: params.skip_to_publish
      ? `Call publish_printify with design_id: ${result.id} and product_types: [${params.product_types.map((p) => `"${p}"`).join(", ")}]`
      : `Design is live in the DB (design_id: ${result.id}). When ready, call publish_printify to push to Printify.`,
  };
}

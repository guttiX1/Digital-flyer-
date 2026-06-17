import { getDb } from "../db/client.js";

interface GetSalesParams {
  days?: number;
  limit?: number;
}

interface SalesResult {
  period_days: number;
  total_revenue: number;
  total_units: number;
  top_sellers: TopSeller[];
  top_designs: TopDesign[];
  feedback: string[];
}

interface TopSeller {
  listing_id: number;
  title: string;
  product_type: string;
  units: number;
  revenue: number;
  design_name: string;
  is_personal: number;
}

interface TopDesign {
  design_id: number;
  design_name: string;
  is_personal: number;
  total_units: number;
  total_revenue: number;
}

export function getSales({ days = 30, limit = 10 }: GetSalesParams): SalesResult {
  const db = getDb();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const totals = db
    .prepare(
      `SELECT COALESCE(SUM(s.revenue),0) AS revenue, COALESCE(SUM(s.units),0) AS units
       FROM merch_sales s WHERE s.sold_at >= ?`
    )
    .get(since) as { revenue: number; units: number };

  const topSellers = db
    .prepare(
      `SELECT
         l.id AS listing_id, l.title, mp.product_type,
         SUM(s.units) AS units, SUM(s.revenue) AS revenue,
         d.name AS design_name, d.is_personal
       FROM merch_sales s
       JOIN merch_listings l ON s.listing_id = l.id
       JOIN merch_products mp ON l.product_id = mp.id
       JOIN designs d ON mp.design_id = d.id
       WHERE s.sold_at >= ?
       GROUP BY l.id
       ORDER BY units DESC
       LIMIT ?`
    )
    .all(since, limit) as TopSeller[];

  const topDesigns = db
    .prepare(
      `SELECT
         d.id AS design_id, d.name AS design_name, d.is_personal,
         SUM(s.units) AS total_units, SUM(s.revenue) AS total_revenue
       FROM merch_sales s
       JOIN merch_listings l ON s.listing_id = l.id
       JOIN merch_products mp ON l.product_id = mp.id
       JOIN designs d ON mp.design_id = d.id
       WHERE s.sold_at >= ?
       GROUP BY d.id
       ORDER BY total_units DESC
       LIMIT ?`
    )
    .all(since, limit) as TopDesign[];

  const feedback = buildFeedback(topDesigns, totals.revenue, days);

  return {
    period_days: days,
    total_revenue: totals.revenue,
    total_units: totals.units,
    top_sellers: topSellers,
    top_designs: topDesigns,
    feedback,
  };
}

function buildFeedback(
  topDesigns: TopDesign[],
  revenue: number,
  days: number
): string[] {
  const msgs: string[] = [];

  if (topDesigns.length === 0) {
    msgs.push(`No sales yet in the last ${days} days. Push some listings live and drive traffic.`);
    return msgs;
  }

  const personalWinners = topDesigns.filter((d) => d.is_personal && d.total_units > 0);
  const aiWinners = topDesigns.filter((d) => !d.is_personal && d.total_units > 0);

  if (personalWinners.length > 0) {
    msgs.push(`Your personal designs are WINNING: ${personalWinners.map((d) => d.design_name).join(", ")}. Double down.`);
  }
  if (aiWinners.length > 0) {
    msgs.push(`AI trend designs selling: ${aiWinners.map((d) => d.design_name).join(", ")}. Reinforce with more variants.`);
  }
  if (revenue > 500) {
    msgs.push(`Strong month — $${revenue.toFixed(2)} revenue. Scale winners with more product types.`);
  } else if (revenue > 0) {
    msgs.push(`$${revenue.toFixed(2)} this period. Focus on top sellers — drop what isn't moving.`);
  }

  const topDesign = topDesigns[0];
  if (topDesign) {
    msgs.push(`Best performer: "${topDesign.design_name}" (${topDesign.total_units} units). Make more in this style.`);
  }

  return msgs;
}

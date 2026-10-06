/** Guards for DXB Interact area-report facts. They read stored fields only. */

export function headlinePrice(extract) {
  const rows = (extract.summary || []).filter((metric) => metric.isHeadlinePrice === true);
  if (rows.length !== 1) return null;
  const [row] = rows;
  if (row.kind !== "area_summary_metric" || row.scope !== "area_summary" || row.metric !== "median_price_aed" || row.isProjectTransaction !== false) return null;
  return row.value;
}

export function bedroomQuoteAsHeadline(sale) {
  if (!sale || sale.kind !== "listed_sale") return null;
  if (sale.bedrooms == null && sale.unitLabel !== "Studio") return null;
  return null;
}

export function communitySummaryIsProjectTransaction(metric) {
  return metric?.scope === "area_summary" && metric.isProjectTransaction === true;
}

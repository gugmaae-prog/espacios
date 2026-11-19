/**
 * Merge reviewed public-source observations into the existing evidence history.
 * Stored D1 rows retain precedence. Values remain evidence, not valuation inputs.
 * The caller invokes this only in the existing successful JSON response branch.
 */
export function aeMergeReviewedEvidenceHistory20261119(entity, storedRows, bundledRows) {
  if (!Array.isArray(storedRows)) return storedRows;
  const additions = bundledRows.filter((row) => row.entity_id === entity);
  if (additions.length === 0) return storedRows;
  const merged = new Map();
  for (const row of storedRows) {
    merged.set(row.id == null ? Symbol('existing-row') : row.id, row);
  }
  for (const row of additions) {
    if (!merged.has(row.id)) merged.set(row.id, row);
  }
  return [...merged.values()].sort((a, b) => {
    const left = String(a.observed_at || '');
    const right = String(b.observed_at || '');
    return left < right ? 1 : left > right ? -1 : 0;
  }).slice(0, 60);
}

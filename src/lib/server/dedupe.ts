import jaroWinkler from "talisman/metrics/jaro-winkler";

export type DedupeInput = {
  emailNorm?: string | null;
  phoneNorm?: string | null;
  domainNorm?: string | null;
  nameNorm?: string | null;
  cityNorm?: string | null;
};

export function isHardDuplicate(row: DedupeInput, existing: DedupeInput) {
  if (row.emailNorm && existing.emailNorm && row.emailNorm === existing.emailNorm) {
    return true;
  }
  if (row.phoneNorm && existing.phoneNorm && row.phoneNorm === existing.phoneNorm) {
    return true;
  }
  if (row.domainNorm && existing.domainNorm && row.domainNorm === existing.domainNorm) {
    return true;
  }
  return false;
}

export function isSoftDuplicate(row: DedupeInput, existing: DedupeInput) {
  if (!row.nameNorm || !row.cityNorm || !existing.nameNorm || !existing.cityNorm) {
    return false;
  }

  if (row.nameNorm === existing.nameNorm && row.cityNorm === existing.cityNorm) {
    return true;
  }

  const closeMatch = jaroWinkler(row.nameNorm, existing.nameNorm) >= 0.9;
  return closeMatch && row.cityNorm === existing.cityNorm;
}

export function softDuplicateScore(row: DedupeInput, existing: DedupeInput) {
  if (!row.nameNorm || !existing.nameNorm) {
    return 0;
  }
  const nameScore = jaroWinkler(row.nameNorm, existing.nameNorm);
  const cityScore = row.cityNorm && existing.cityNorm && row.cityNorm === existing.cityNorm ? 1 : 0;
  return Number((nameScore * 0.8 + cityScore * 0.2).toFixed(4));
}

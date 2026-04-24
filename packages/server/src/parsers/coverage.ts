export interface CoverageResult {
  lineCoveragePct: number | null;
  linesFound: number;
  linesHit: number;
}

export function parseLcov(lcovContent: string): CoverageResult {
  let linesFound = 0;
  let linesHit = 0;

  for (const line of lcovContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("LF:")) {
      linesFound += parseInt(trimmed.slice(3), 10) || 0;
    } else if (trimmed.startsWith("LH:")) {
      linesHit += parseInt(trimmed.slice(3), 10) || 0;
    }
  }

  const lineCoveragePct = linesFound > 0
    ? Math.round((linesHit / linesFound) * 10000) / 100
    : null;

  return {
    lineCoveragePct,
    linesFound,
    linesHit,
  };
}

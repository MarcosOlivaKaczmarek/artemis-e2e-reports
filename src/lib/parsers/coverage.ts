export interface CoverageResult {
  lineCoveragePct: number;
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

  const lineCoveragePct = linesFound > 0 ? (linesHit / linesFound) * 100 : 0;

  return {
    lineCoveragePct: Math.round(lineCoveragePct * 100) / 100,
    linesFound,
    linesHit,
  };
}

export interface MonocartRow {
  type?: string;
  title?: string;
  attachments?: { name: string; path: string; contentType?: string }[];
  subs?: MonocartRow[];
}

/** Recursively extract test title -> video path mappings from monocart JSON rows. */
export function extractVideoMap(
  rows: MonocartRow[],
  map: Map<string, string>,
  runId: string,
  monocartDirName: string,
): void {
  for (const row of rows) {
    if (row.type === "case" && row.attachments) {
      const video = row.attachments.find(
        (a) =>
          a.name === "video" &&
          (a.contentType?.startsWith("video/") ??
            (a.path.endsWith(".webm") || a.path.endsWith(".mp4"))),
      );
      if (video && row.title) {
        map.set(row.title, `/reports/${runId}/${monocartDirName}/${video.path}`);
      }
    }
    if (row.subs) {
      extractVideoMap(row.subs, map, runId, monocartDirName);
    }
  }
}

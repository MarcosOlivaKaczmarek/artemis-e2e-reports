import { getDb } from "@/lib/db";
import { getRunDir } from "@/lib/reports";
import { auth, authEnabled } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { Run } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import fs from "fs";
import path from "path";

function getMonocartReports(runId: string): { name: string; label: string; path: string }[] {
  const runDir = getRunDir(runId);
  const reports: { name: string; label: string; path: string }[] = [];

  try {
    const entries = fs.readdirSync(runDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith("monocart")) {
        const indexPath = path.join(runDir, entry.name, "index.html");
        if (fs.existsSync(indexPath)) {
          const suffix = entry.name.replace("monocart-", "").replace("monocart", "");
          const label = suffix
            ? suffix.charAt(0).toUpperCase() + suffix.slice(1)
            : "Report";
          reports.push({
            name: entry.name,
            label,
            path: `/reports/${runId}/${entry.name}/index.html`,
          });
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  // Sort so parallel comes before sequential
  reports.sort((a, b) => a.name.localeCompare(b.name));
  return reports;
}

export default async function MonocartViewer({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ report?: string }>;
}) {
  if (authEnabled) {
    const session = await auth();
    if (!session?.user) {
      redirect("/api/auth/signin");
    }
  }

  const { id } = await params;
  const { report: selectedReport } = await searchParams;
  const db = getDb();

  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Run | undefined;
  if (!run || !run.has_monocart || run.reports_deleted) {
    notFound();
  }

  const reports = getMonocartReports(id);
  if (reports.length === 0) {
    notFound();
  }

  // Use selected report or default to first
  const active = reports.find((r) => r.name === selectedReport) || reports[0];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-4 p-3 border-b bg-background shrink-0">
        <Link
          href={`/runs/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to run
        </Link>
        <span className="text-sm font-medium">{run.branch}</span>
        <span className="text-sm font-mono text-muted-foreground">
          {run.commit_sha.slice(0, 7)}
        </span>
        <StatusBadge status={run.status} />
        {reports.length > 1 ? (
          <div className="flex gap-1 ml-auto">
            {reports.map((r) => (
              <Link
                key={r.name}
                href={`/runs/${id}/monocart?report=${r.name}`}
                className={`text-sm px-3 py-1 rounded-md ${
                  r.name === active.name
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground ml-auto">
            Monocart Report
          </span>
        )}
      </div>
      <iframe
        key={active.name}
        src={active.path}
        className="flex-1 w-full border-0"
        title={`Monocart Report - ${active.label}`}
      />
    </div>
  );
}

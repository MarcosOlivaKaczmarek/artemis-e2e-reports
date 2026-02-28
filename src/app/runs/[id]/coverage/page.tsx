import { getDb } from "@/lib/db";
import { auth, authEnabled } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { Run } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";

export default async function CoverageViewer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (authEnabled) {
    const session = await auth();
    if (!session?.user) {
      redirect("/api/auth/signin");
    }
  }

  const { id } = await params;
  const db = getDb();

  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Run | undefined;
  if (!run || !run.has_coverage || run.reports_deleted) {
    notFound();
  }

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
        {run.coverage_pct != null && (
          <span className="text-sm font-medium">
            {run.coverage_pct.toFixed(1)}%
          </span>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          Coverage Report
        </span>
      </div>
      <iframe
        src={`/reports/${id}/coverage/index.html`}
        className="flex-1 w-full border-0"
        title="Coverage Report"
      />
    </div>
  );
}

"use client";

import Link from "next/link";
import { Run } from "@/lib/types";
import { StatusBadge } from "./status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds % 60}s`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RunsTable({ runs }: { runs: Run[] }) {
  if (runs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No runs found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Branch / PR</TableHead>
          <TableHead>Commit</TableHead>
          <TableHead>Phase</TableHead>
          <TableHead className="text-right">Tests</TableHead>
          <TableHead className="text-right">Pass</TableHead>
          <TableHead className="text-right">Fail</TableHead>
          <TableHead className="text-right">Coverage</TableHead>
          <TableHead className="text-right">Duration</TableHead>
          <TableHead className="text-right">Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell>
              <Link href={`/runs/${run.id}`} className="hover:underline">
                <StatusBadge status={run.status} />
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/runs/${run.id}`} className="hover:underline font-medium">
                {run.branch}
              </Link>
              {run.pr_number && (
                <a
                  href={`https://github.com/ls1intum/Artemis/pull/${run.pr_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-sm text-muted-foreground hover:underline"
                >
                  #{run.pr_number}
                </a>
              )}
            </TableCell>
            <TableCell className="font-mono text-sm">
              {run.commit_sha.slice(0, 7)}
            </TableCell>
            <TableCell>{run.phase}</TableCell>
            <TableCell className="text-right">{run.total_tests}</TableCell>
            <TableCell className="text-right text-green-600">
              {run.passed_tests}
            </TableCell>
            <TableCell className="text-right text-red-600">
              {run.failed_tests > 0 ? run.failed_tests : "-"}
            </TableCell>
            <TableCell className="text-right">
              {run.coverage_pct != null ? `${run.coverage_pct.toFixed(1)}%` : "-"}
            </TableCell>
            <TableCell className="text-right">
              {formatDuration(run.duration_ms)}
            </TableCell>
            <TableCell className="text-right text-sm text-muted-foreground">
              {formatDate(run.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

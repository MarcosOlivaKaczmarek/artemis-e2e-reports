"use client";

import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  success: { label: "Passed", variant: "default" },
  failure: { label: "Failed", variant: "destructive" },
  partial: { label: "Partial", variant: "secondary" },
  uploading: { label: "Uploading", variant: "outline" },
  passed: { label: "Passed", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  skipped: { label: "Skipped", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

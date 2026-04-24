import { Badge } from "@/components/ui/badge";
import type { Run, TestCase } from "@artemis-e2e/shared";

type Status = Run["status"] | TestCase["status"];

const STATUS_MAP: Record<Status, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  success: { label: "Passed", variant: "default" },
  failure: { label: "Failed", variant: "destructive" },
  partial: { label: "Partial", variant: "secondary" },
  uploading: { label: "Uploading", variant: "outline" },
  passed: { label: "Passed", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  skipped: { label: "Skipped", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = STATUS_MAP[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

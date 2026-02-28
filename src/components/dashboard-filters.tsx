"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function DashboardFilters({ branches }: { branches: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/?${params.toString()}`);
  }

  function clearFilters() {
    router.push("/");
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Select
        value={searchParams.get("branch") || "all"}
        onValueChange={(v) => updateFilter("branch", v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Branch" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All branches</SelectItem>
          {branches.map((b) => (
            <SelectItem key={b} value={b}>
              {b}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("status") || "all"}
        onValueChange={(v) => updateFilter("status", v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="success">Passed</SelectItem>
          <SelectItem value="failure">Failed</SelectItem>
          <SelectItem value="partial">Partial</SelectItem>
        </SelectContent>
      </Select>

      <Input
        placeholder="PR #"
        className="w-[100px]"
        type="number"
        defaultValue={searchParams.get("pr_number") || ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            updateFilter("pr_number", (e.target as HTMLInputElement).value);
          }
        }}
      />

      {(searchParams.get("branch") || searchParams.get("status") || searchParams.get("pr_number")) && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

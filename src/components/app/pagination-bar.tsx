"use client";

import { Button } from "@/components/ui/button";

type PaginationBarProps = {
  page: number;
  pageSize: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
};

export function PaginationBar({
  page,
  pageSize,
  total,
  onPrevious,
  onNext,
}: PaginationBarProps) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const hasPrevious = page > 1;
  const hasNext = end < total;

  return (
    <div className="mt-4 flex items-center justify-between rounded-xl border bg-card p-3">
      <p className="text-sm text-muted-foreground">
        Showing {total === 0 ? 0 : start}-{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={!hasPrevious}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext}>
          Next
        </Button>
      </div>
    </div>
  );
}

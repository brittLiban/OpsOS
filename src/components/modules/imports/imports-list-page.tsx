"use client";

import Link from "next/link";
import { ImportRunStatus } from "@prisma/client";
import { PageHeader } from "@/components/app/page-header";
import { DataTable } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import { EmptyState } from "@/components/app/empty-state";

type ImportRun = {
  id: string;
  filename: string;
  status: ImportRunStatus;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  hardDuplicateCount: number;
  softDuplicateCount: number;
  errorCount: number;
  createdAt: Date;
};

export function ImportsListPage({ runs }: { runs: ImportRun[] }) {
  const columns: ColumnDef<ImportRun>[] = [
    {
      accessorKey: "filename",
      header: "File",
      cell: ({ row }) => (
        <Link href={`/imports/${row.original.id}`} className="font-medium hover:underline">
          {row.original.filename}
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge label={row.original.status} />,
    },
    {
      accessorKey: "totalRows",
      header: "Rows",
      cell: ({ row }) => row.original.totalRows,
    },
    {
      accessorKey: "processedRows",
      header: "Processed",
      cell: ({ row }) => row.original.processedRows,
    },
    {
      id: "created",
      header: "Created",
      cell: ({ row }) => row.original.createdCount,
    },
    {
      id: "createdAt",
      header: "Created",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Imports"
        subtitle="Track CSV lead imports and dedupe outcomes."
        actions={
          <Button asChild>
            <Link href="/imports/new">New Import</Link>
          </Button>
        }
      />
      {runs.length === 0 ? (
        <EmptyState
          title="No import runs yet"
          description="Upload a CSV to create your first import run."
          ctaLabel="Start Import"
          ctaHref="/imports/new"
        />
      ) : (
        <DataTable columns={columns} data={runs} />
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { ImportRunStatus } from "@prisma/client";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
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
  const [rows, setRows] = React.useState(runs);

  async function deleteImportRun(runId: string) {
    const response = await fetch(`/api/v1/imports/${runId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Failed to delete import run");
      return;
    }
    setRows((current) => current.filter((run) => run.id !== runId));
    toast.success("Import run deleted");
  }

  async function deleteAllImports() {
    const response = await fetch("/api/v1/imports", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deleteAll: true,
      }),
    });
    if (!response.ok) {
      toast.error("Failed to delete import runs");
      return;
    }
    setRows([]);
    toast.success("All import runs deleted");
  }

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
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="ghost">
              Delete
            </Button>
          }
          title="Delete Import Run"
          description={`Delete import run ${row.original.id.slice(0, 8)} and its row records? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => deleteImportRun(row.original.id)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Imports"
        subtitle="Track lead imports and dedupe outcomes."
        actions={
          <div className="flex items-center gap-2">
            {rows.length > 0 ? (
              <ConfirmDialog
                trigger={<Button variant="destructive">Delete All Imports</Button>}
                title="Delete All Import Runs"
                description="This will delete every import run and import row history in your workspace."
                confirmLabel="Delete All"
                onConfirm={deleteAllImports}
              />
            ) : null}
            <Button asChild>
              <Link href="/imports/new">New Import</Link>
            </Button>
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No import runs yet"
          description="Upload a CSV or Excel file to create your first import run."
          ctaLabel="Start Import"
          ctaHref="/imports/new"
        />
      ) : (
        <DataTable columns={columns} data={rows} />
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

type ImportRun = {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  hardDuplicateCount: number;
  softDuplicateCount: number;
  errorCount: number;
};

type ImportRow = {
  id: string;
  rowNumber: number;
  status: string;
  reason: string | null;
  rawJson: Record<string, unknown>;
  matchedLeadId: string | null;
  softScore: number | null;
};

export function ImportDetailPage({ run }: { run: ImportRun }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<"created" | "hard" | "soft" | "errors">(
    "created",
  );
  const [rows, setRows] = React.useState<ImportRow[]>([]);
  const [selectedRow, setSelectedRow] = React.useState<ImportRow | null>(null);
  const [mergeChoice, setMergeChoice] = React.useState<"LINK_EXISTING" | "CREATE" | "SKIP" | "MERGE">(
    "LINK_EXISTING",
  );
  const [mergeReason, setMergeReason] = React.useState("Soft duplicate review");
  const [loading, setLoading] = React.useState(false);

  const loadRows = React.useCallback(async () => {
    const response = await fetch(`/api/v1/imports/${run.id}/results?tab=${activeTab}`, {
      cache: "no-store",
    });
    const json = (await response.json()) as {
      data: {
        rows: ImportRow[];
      };
    };
    setRows(json.data.rows);
  }, [activeTab, run.id]);

  React.useEffect(() => {
    void loadRows();
  }, [loadRows]);

  async function resolveSoftDuplicate() {
    if (!selectedRow) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/imports/${run.id}/rows/${selectedRow.id}/resolve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: mergeChoice,
            matchedLeadId: selectedRow.matchedLeadId ?? undefined,
            reason: mergeReason,
          }),
        },
      );
      if (!response.ok) {
        throw new Error();
      }
      toast.success("Row resolved");
      setSelectedRow(null);
      await loadRows();
    } catch {
      toast.error("Failed to resolve row");
    } finally {
      setLoading(false);
    }
  }

  async function deleteImportRun() {
    const response = await fetch(`/api/v1/imports/${run.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Failed to delete import run");
      return;
    }
    toast.success("Import run deleted");
    router.push("/imports");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Import Run ${run.id.slice(0, 8)}`}
        subtitle={run.filename}
        actions={
          <div className="flex items-center gap-2">
            <ConfirmDialog
              trigger={<Button variant="destructive">Delete Import Run</Button>}
              title="Delete Import Run"
              description="This will permanently delete this import run and all import row records."
              confirmLabel="Delete"
              onConfirm={deleteImportRun}
            />
            <Button variant="secondary" asChild>
              <Link href="/imports">Back to Imports</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Status" value={<StatusBadge label={run.status} />} />
        <SummaryCard title="Total Rows" value={String(run.totalRows)} />
        <SummaryCard title="Created" value={String(run.createdCount)} />
        <SummaryCard title="Hard Duplicates" value={String(run.hardDuplicateCount)} />
        <SummaryCard title="Soft Duplicates" value={String(run.softDuplicateCount)} />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as never)}>
        <TabsList>
          <TabsTrigger value="created">Created</TabsTrigger>
          <TabsTrigger value="hard">Hard Duplicates Skipped</TabsTrigger>
          <TabsTrigger value="soft">Soft Duplicates Flagged</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>Rows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rows for this tab.</p>
              ) : (
                rows.map((row) => (
                  <div key={row.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Row {row.rowNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.reason ?? row.status}
                        </p>
                      </div>
                      {activeTab === "soft" ? (
                        <Dialog
                          open={selectedRow?.id === row.id}
                          onOpenChange={(open) => setSelectedRow(open ? row : null)}
                        >
                          <DialogTrigger asChild>
                            <Button size="sm">Review</Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Soft Duplicate Review</DialogTitle>
                              <DialogDescription>
                                Choose how to resolve this duplicate candidate.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 md:grid-cols-2">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Incoming Row</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                                    {JSON.stringify(row.rawJson, null, 2)}
                                  </pre>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Existing Candidate</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                  <p>ID: {row.matchedLeadId ?? "None"}</p>
                                  <p>Score: {row.softScore ?? "-"}</p>
                                </CardContent>
                              </Card>
                            </div>
                            <div className="space-y-3">
                              <Label>Action</Label>
                              <RadioGroup
                                value={mergeChoice}
                                onValueChange={(value) =>
                                  setMergeChoice(value as "LINK_EXISTING" | "CREATE" | "SKIP" | "MERGE")
                                }
                              >
                                <label className="flex items-center gap-2 text-sm">
                                  <RadioGroupItem value="LINK_EXISTING" />
                                  Link existing
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <RadioGroupItem value="MERGE" />
                                  Merge with existing
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <RadioGroupItem value="CREATE" />
                                  Create new lead
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <RadioGroupItem value="SKIP" />
                                  Skip
                                </label>
                              </RadioGroup>
                              <Label>Reason</Label>
                              <Textarea
                                value={mergeReason}
                                onChange={(event) => setMergeReason(event.target.value)}
                              />
                            </div>
                            <Button onClick={resolveSoftDuplicate} disabled={loading}>
                              {loading ? "Saving..." : "Confirm Resolution"}
                            </Button>
                          </DialogContent>
                        </Dialog>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-lg font-semibold">{value}</CardContent>
    </Card>
  );
}

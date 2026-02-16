"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Pipeline = {
  id: string;
  name: string;
  stages: {
    id: string;
    name: string;
  }[];
};

type CustomField = {
  id: string;
  key: string;
  label: string;
};

type PreviewRow = {
  id: string;
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Record<string, unknown>;
  errors: string[];
};

const IGNORE_MAPPING_VALUE = "__IGNORE__";

export function ImportNewPage({
  pipelines,
  customFields,
}: {
  pipelines: Pipeline[];
  customFields: CustomField[];
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [file, setFile] = React.useState<File | null>(null);
  const [importRunId, setImportRunId] = React.useState<string | null>(null);
  const [previewRows, setPreviewRows] = React.useState<PreviewRow[]>([]);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [defaultPipelineId, setDefaultPipelineId] = React.useState(pipelines[0]?.id ?? "");
  const [defaultStageId, setDefaultStageId] = React.useState(pipelines[0]?.stages[0]?.id ?? "");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const selectedPipeline = pipelines.find((pipeline) => pipeline.id === defaultPipelineId);

  const destinationOptions = React.useMemo(() => {
    const base = [
      "businessName",
      "contactName",
      "email",
      "phone",
      "website",
      "city",
      "source",
      "niche",
    ];
    return [...base, ...customFields.map((field) => `custom:${field.key}`)];
  }, [customFields]);

  async function uploadCsv() {
    const selectedFile = file ?? fileInputRef.current?.files?.[0] ?? null;
    if (!selectedFile) {
      toast.error("Select a CSV file first");
      return;
    }

    if (!file) {
      setFile(selectedFile);
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("idempotencyKey", crypto.randomUUID());
      const response = await fetch("/api/v1/imports/start", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error();
      }
      const json = (await response.json()) as { data: { id: string } };
      setImportRunId(json.data.id);
      await loadPreview(json.data.id);
      setStep(2);
      toast.success("CSV uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview(runId: string) {
    const response = await fetch(`/api/v1/imports/${runId}/preview?limit=50`, {
      cache: "no-store",
    });
    const json = (await response.json()) as { data: { rows: PreviewRow[] } };
    setPreviewRows(json.data.rows);

    if (Object.keys(mapping).length === 0 && json.data.rows.length > 0) {
      const headers = Object.keys(json.data.rows[0].raw);
      const defaults = Object.fromEntries(
        headers.map((header) => {
          const candidate = destinationOptions.find(
            (option) => option.toLowerCase() === header.trim().toLowerCase().replace(/\s+/g, ""),
          );
          return [header, candidate ?? ""];
        }),
      );
      setMapping(defaults);
    }
  }

  async function saveMappingAndPreview() {
    if (!importRunId) {
      return;
    }
    setLoading(true);
    try {
      const payloadMapping = {
        ...mapping,
        "$default:pipelineId": defaultPipelineId,
        "$default:stageId": defaultStageId,
      };
      const response = await fetch(`/api/v1/imports/${importRunId}/map`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mapping: payloadMapping,
        }),
      });
      if (!response.ok) {
        throw new Error();
      }
      await loadPreview(importRunId);
      setStep(3);
      toast.success("Mapping updated");
    } catch {
      toast.error("Failed to save mapping");
    } finally {
      setLoading(false);
    }
  }

  async function executeImport() {
    if (!importRunId) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/imports/${importRunId}/execute`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error();
      }
      toast.success("Import completed");
      router.push(`/imports/${importRunId}`);
    } catch {
      toast.error("Import execution failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Import"
        subtitle="Upload CSV, map fields, preview, and execute."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((number) => (
          <Card key={number} className={step === number ? "border-primary" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Step {number}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {number === 1 ? "Upload CSV" : number === 2 ? "Map columns" : "Preview + execute"}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1) Upload CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setFile(selected);
            }}
          />
          <Button onClick={uploadCsv} disabled={loading}>
            {loading ? "Uploading..." : "Upload CSV"}
          </Button>
        </CardContent>
      </Card>

      {importRunId ? (
        <Card>
          <CardHeader>
            <CardTitle>2) Map Columns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Default Pipeline</Label>
                <Select
                  value={defaultPipelineId}
                  onValueChange={(value) => {
                    setDefaultPipelineId(value);
                    const stage = pipelines.find((pipeline) => pipeline.id === value)?.stages[0];
                    if (stage) {
                      setDefaultStageId(stage.id);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Stage</Label>
                <Select value={defaultStageId} onValueChange={setDefaultStageId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedPipeline?.stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {Object.keys(mapping).map((header) => (
                <div key={header} className="space-y-1 rounded-lg border p-3">
                  <p className="text-xs font-semibold">{header}</p>
                  <Select
                    value={
                      mapping[header] && mapping[header].length > 0
                        ? mapping[header]
                        : IGNORE_MAPPING_VALUE
                    }
                    onValueChange={(value) =>
                      setMapping((current) => ({
                        ...current,
                        [header]: value === IGNORE_MAPPING_VALUE ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ignore column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORE_MAPPING_VALUE}>Ignore</SelectItem>
                      {destinationOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Button onClick={saveMappingAndPreview} disabled={loading}>
              {loading ? "Saving..." : "Save Mapping"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle>3) Preview First 50 Rows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>{String(row.mapped.businessName ?? "-")}</TableCell>
                      <TableCell>{String(row.mapped.email ?? "-")}</TableCell>
                      <TableCell>{String(row.mapped.phone ?? "-")}</TableCell>
                      <TableCell>
                        {row.errors.length === 0 ? (
                          <Badge variant="outline">Valid</Badge>
                        ) : (
                          <Badge variant="destructive">{row.errors.join(", ")}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={executeImport} disabled={loading}>
              {loading ? "Executing..." : "Start Import"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

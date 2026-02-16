"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MoreHorizontal, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PaginationBar } from "@/components/app/pagination-bar";
import { PageHeader } from "@/components/app/page-header";
import { StageBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { TableSkeleton } from "@/components/app/loading-states";

type Pipeline = {
  id: string;
  name: string;
  stages: {
    id: string;
    name: string;
    color: string;
  }[];
};

type CustomField = {
  id: string;
  key: string;
  label: string;
  fieldType: "TEXT" | "TEXTAREA" | "NUMBER" | "SELECT" | "MULTI_SELECT" | "DATE" | "BOOLEAN";
  isRequired: boolean;
  showInTable: boolean;
  options: { label: string; value: string }[];
};

type LeadRow = {
  id: string;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  source: string | null;
  niche: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  stage: { id: string; name: string; color: string };
  customData: Record<string, unknown>;
};

type LeadsResponse = {
  data: {
    rows: LeadRow[];
    page: number;
    pageSize: number;
    total: number;
  };
};

const leadFormSchema = z.object({
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  businessName: z.string().trim().min(1),
  contactName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  niche: z.string().optional(),
  customData: z.record(z.string(), z.unknown()),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

export function LeadsPageClient({
  pipelines,
  customFields,
}: {
  pipelines: Pipeline[];
  customFields: CustomField[];
}) {
  const [rows, setRows] = React.useState<LeadRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(25);
  const [total, setTotal] = React.useState(0);
  const [q, setQ] = React.useState("");
  const [pipelineId, setPipelineId] = React.useState<string>("all");
  const [stageId, setStageId] = React.useState<string>("all");
  const [source, setSource] = React.useState("");
  const [niche, setNiche] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [leadDeleteCandidate, setLeadDeleteCandidate] = React.useState<LeadRow | null>(null);
  const [visibleCustomColumns, setVisibleCustomColumns] = React.useState<string[]>(
    customFields.filter((field) => field.showInTable).map((field) => field.key),
  );

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      pipelineId: pipelines[0]?.id ?? "",
      stageId: pipelines[0]?.stages[0]?.id ?? "",
      businessName: "",
      contactName: "",
      email: "",
      phone: "",
      website: "",
      city: "",
      source: "",
      niche: "",
      customData: {},
    },
  });

  const selectedPipeline = pipelines.find((pipeline) => pipeline.id === form.watch("pipelineId"));

  const debouncedQ = useDebouncedValue(q, 300);

  const fetchRows = React.useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (debouncedQ) {
        query.set("q", debouncedQ);
      }
      if (pipelineId !== "all") {
        query.set("pipelineId", pipelineId);
      }
      if (stageId !== "all") {
        query.set("stageId", stageId);
      }
      if (source) {
        query.set("source", source);
      }
      if (niche) {
        query.set("niche", niche);
      }
      const response = await fetch(`/api/v1/leads?${query.toString()}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as LeadsResponse;
      setRows(json.data.rows);
      setTotal(json.data.total);
    } catch {
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, niche, page, pageSize, pipelineId, source, stageId]);

  React.useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  React.useEffect(() => {
    if (!selectedPipeline?.stages.find((stage) => stage.id === form.getValues("stageId"))) {
      form.setValue("stageId", selectedPipeline?.stages[0]?.id ?? "");
    }
  }, [form, selectedPipeline]);

  const baseColumns: ColumnDef<LeadRow>[] = [
    {
      accessorKey: "businessName",
      header: "Business",
      cell: ({ row }) => (
        <Link href={`/leads/${row.original.id}`} className="font-medium hover:underline">
          {row.original.businessName}
        </Link>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => row.original.phone ?? "-",
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email ?? "-",
    },
    {
      accessorKey: "city",
      header: "City",
      cell: ({ row }) => row.original.city ?? "-",
    },
    {
      id: "stage",
      header: "Stage",
      cell: ({ row }) => (
        <StageBadge
          label={row.original.stage.name}
          color={row.original.stage.color}
        />
      ),
    },
    {
      id: "followUp",
      header: "Next Follow-up",
      cell: ({ row }) =>
        row.original.nextFollowUpAt
          ? new Date(row.original.nextFollowUpAt).toLocaleDateString()
          : "-",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Row actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/leads/${row.original.id}`}>View</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/leads/${row.original.id}?modal=touchpoint`}>Log Touchpoint</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/leads/${row.original.id}?modal=followup`}>Set Follow-up</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/pipeline?leadId=${row.original.id}`}>Move Stage</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/leads/${row.original.id}?action=convert`}>Convert to Client</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onSelect={(event) => {
                event.preventDefault();
                setLeadDeleteCandidate(row.original);
              }}
            >
              Delete Lead
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const customColumns: ColumnDef<LeadRow>[] = customFields
    .filter((field) => visibleCustomColumns.includes(field.key))
    .map((field) => ({
      id: `custom.${field.key}`,
      header: field.label,
      cell: ({ row }) => {
        const value = row.original.customData?.[field.key];
        if (value === undefined || value === null || value === "") {
          return "-";
        }
        if (Array.isArray(value)) {
          return value.join(", ");
        }
        return String(value);
      },
    }));

  const columns = [
    ...baseColumns.slice(0, 5),
    ...customColumns,
    ...baseColumns.slice(5),
  ];

  async function deleteLead(leadId: string) {
    try {
      const response = await fetch(`/api/v1/leads/${leadId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error();
      }
      setRows((current) => current.filter((row) => row.id !== leadId));
      setTotal((current) => Math.max(0, current - 1));
      toast.success("Lead deleted");
    } catch {
      toast.error("Failed to delete lead");
    }
  }

  async function deleteAllLeads() {
    try {
      const response = await fetch("/api/v1/leads", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      if (!response.ok) {
        throw new Error();
      }
      setRows([]);
      setTotal(0);
      setPage(1);
      toast.success("All leads deleted");
    } catch {
      toast.error("Failed to delete leads");
    }
  }

  async function onCreateLead(values: LeadFormValues) {
    try {
      const response = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        throw new Error("Create lead failed");
      }
      const json = (await response.json()) as { data: { id: string } };
      toast.success("Lead created");
      setCreateOpen(false);
      form.reset({
        ...form.getValues(),
        businessName: "",
        contactName: "",
        email: "",
        phone: "",
        city: "",
      });
      await fetchRows();
      window.location.href = `/leads/${json.data.id}`;
    } catch {
      toast.error("Failed to create lead");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leads"
        subtitle="Server-paginated lead management with custom field support."
        actions={
          <>
            {total > 0 ? (
              <ConfirmDialog
                trigger={<Button variant="destructive">Delete All Leads</Button>}
                title="Delete All Leads"
                description="This will permanently delete every lead and related lead activity in your workspace."
                confirmLabel="Delete All"
                onConfirm={deleteAllLeads}
              />
            ) : null}
            <Button variant="secondary" asChild>
              <Link href="/imports/new">Import File</Link>
            </Button>
            <Sheet open={createOpen} onOpenChange={setCreateOpen}>
              <SheetTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Lead
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>Create Lead</SheetTitle>
                </SheetHeader>
                <Form {...form}>
                  <form
                    className="mt-6 space-y-4"
                    onSubmit={form.handleSubmit(onCreateLead)}
                  >
                    <FormField
                      control={form.control}
                      name="pipelineId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pipeline</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {pipelines.map((pipeline) => (
                                <SelectItem key={pipeline.id} value={pipeline.id}>
                                  {pipeline.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stageId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stage</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {selectedPipeline?.stages.map((stage) => (
                                <SelectItem key={stage.id} value={stage.id}>
                                  {stage.name}
                                </SelectItem>
                              )) ?? <SelectItem value="">No stages</SelectItem>}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="businessName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {(["contactName", "email", "phone", "city", "source", "niche"] as const).map((fieldName) => (
                        <FormField
                          key={fieldName}
                          control={form.control}
                          name={fieldName}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{toTitle(fieldName)}</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value ?? ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4 rounded-lg border p-4">
                      <p className="text-sm font-semibold">Custom Fields</p>
                      {customFields.map((field) => (
                        <DynamicCustomField
                          key={field.id}
                          field={field}
                          value={form.watch(`customData.${field.key}`)}
                          onChange={(value) => {
                            const current = form.getValues("customData");
                            form.setValue("customData", {
                              ...current,
                              [field.key]: value,
                            });
                          }}
                        />
                      ))}
                    </div>

                    <Button type="submit" className="w-full">
                      Save Lead
                    </Button>
                  </form>
                </Form>
              </SheetContent>
            </Sheet>
          </>
        }
      />

      <FilterBar>
        <Input
          value={q}
          onChange={(event) => {
            setPage(1);
            setQ(event.target.value);
          }}
          placeholder="Search business, phone, email, city"
          className="w-full md:w-72"
        />
        <Select
          value={pipelineId}
          onValueChange={(value) => {
            setPage(1);
            setPipelineId(value);
            setStageId("all");
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Pipeline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pipelines</SelectItem>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={stageId}
          onValueChange={(value) => {
            setPage(1);
            setStageId(value);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {(pipelineId === "all"
              ? pipelines.flatMap((pipeline) => pipeline.stages)
              : pipelines.find((pipeline) => pipeline.id === pipelineId)?.stages ?? []
            ).map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={niche}
          onChange={(event) => {
            setPage(1);
            setNiche(event.target.value);
          }}
          placeholder="Niche"
          className="w-[150px]"
        />
        <Input
          value={source}
          onChange={(event) => {
            setPage(1);
            setSource(event.target.value);
          }}
          placeholder="Source"
          className="w-[150px]"
        />
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="ml-auto">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Column Chooser</DialogTitle>
              <DialogDescription>
                Toggle custom fields marked for table view.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {customFields.map((field) => (
                <label key={field.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={visibleCustomColumns.includes(field.key)}
                    onCheckedChange={(checked) => {
                      setVisibleCustomColumns((current) =>
                        checked
                          ? [...current, field.key]
                          : current.filter((key) => key !== field.key),
                      );
                    }}
                  />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </FilterBar>

      {loading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description="Add a lead manually or import a CSV/Excel file to start populating your pipeline."
          ctaLabel="Create Lead"
          onCta={() => setCreateOpen(true)}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            emptyState={<span>No leads found.</span>}
          />
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        </>
      )}

      <AlertDialog
        open={leadDeleteCandidate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLeadDeleteCandidate(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              {leadDeleteCandidate
                ? `Delete ${leadDeleteCandidate.businessName} and related lead activity? This action cannot be undone.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (leadDeleteCandidate) {
                  void deleteLead(leadDeleteCandidate.id);
                }
                setLeadDeleteCandidate(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DynamicCustomField({
  field,
  value,
  onChange,
}: {
  field: CustomField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{field.label}</label>
      {field.fieldType === "TEXTAREA" ? (
        <Textarea
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
      {field.fieldType === "SELECT" ? (
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.label}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {field.fieldType === "BOOLEAN" ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(Boolean(checked))}
          />
          <span>Enabled</span>
        </label>
      ) : null}
      {["TEXT", "NUMBER", "DATE"].includes(field.fieldType) ? (
        <Input
          type={field.fieldType === "NUMBER" ? "number" : field.fieldType === "DATE" ? "date" : "text"}
          value={String(value ?? "")}
          onChange={(event) =>
            onChange(
              field.fieldType === "NUMBER"
                ? Number(event.target.value)
                : event.target.value,
            )
          }
        />
      ) : null}
      {field.fieldType === "MULTI_SELECT" ? (
        <div className="grid grid-cols-1 gap-2">
          {field.options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Array.isArray(value) ? value.includes(option.value) : false}
                onCheckedChange={(checked) => {
                  const current = Array.isArray(value) ? value : [];
                  onChange(
                    checked
                      ? [...current, option.value]
                      : current.filter((item) => item !== option.value),
                  );
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function toTitle(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase())
    .trim();
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

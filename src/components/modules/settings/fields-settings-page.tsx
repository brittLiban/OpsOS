"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = {
  id: string;
  label: string;
  value: string;
  sortOrder: number;
  isActive: boolean;
};

type Field = {
  id: string;
  entityType: "LEAD" | "CLIENT" | "TASK";
  key: string;
  label: string;
  fieldType:
    | "TEXT"
    | "TEXTAREA"
    | "NUMBER"
    | "SELECT"
    | "MULTI_SELECT"
    | "DATE"
    | "BOOLEAN";
  isRequired: boolean;
  showInTable: boolean;
  isActive: boolean;
  sortOrder: number;
  options: Option[];
};

const FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "SELECT",
  "MULTI_SELECT",
  "DATE",
  "BOOLEAN",
] as const;

export function FieldsSettingsPage({
  initialFields,
  initialEntityType = "LEAD",
  lockEntityType = false,
}: {
  initialFields: Field[];
  initialEntityType?: "LEAD" | "CLIENT" | "TASK";
  lockEntityType?: boolean;
}) {
  const [fields, setFields] = React.useState(initialFields);
  const [entityType, setEntityType] = React.useState<"LEAD" | "CLIENT" | "TASK">(initialEntityType);
  const [openCreate, setOpenCreate] = React.useState(false);
  const [key, setKey] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [fieldType, setFieldType] = React.useState<(typeof FIELD_TYPES)[number]>("TEXT");
  const [isRequired, setIsRequired] = React.useState(false);
  const [showInTable, setShowInTable] = React.useState(false);

  const [optionFieldId, setOptionFieldId] = React.useState<string | null>(null);
  const [optionLabel, setOptionLabel] = React.useState("");
  const [optionValue, setOptionValue] = React.useState("");

  const visibleFields = fields.filter((field) => field.entityType === entityType && field.isActive);

  function resetForm() {
    setKey("");
    setLabel("");
    setFieldType("TEXT");
    setIsRequired(false);
    setShowInTable(false);
  }

  async function createField() {
    const response = await fetch("/api/v1/settings/fields", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType,
        key,
        label,
        fieldType,
        isRequired,
        showInTable,
        sortOrder: visibleFields.length,
      }),
    });
    if (!response.ok) {
      toast.error("Failed to create field");
      return;
    }
    const json = (await response.json()) as { data: Field };
    setFields((current) => [...current, { ...json.data, options: [] }]);
    toast.success("Field created");
    setOpenCreate(false);
    resetForm();
  }

  async function toggleFieldProperty(
    fieldId: string,
    payload: Partial<Pick<Field, "isRequired" | "showInTable">>,
  ) {
    const response = await fetch(`/api/v1/settings/fields/${fieldId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      toast.error("Failed to update field");
      return;
    }
    setFields((current) =>
      current.map((field) => (field.id === fieldId ? { ...field, ...payload } : field)),
    );
  }

  async function deleteField(fieldId: string) {
    const response = await fetch(`/api/v1/settings/fields/${fieldId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Failed to delete field");
      return;
    }
    setFields((current) =>
      current.map((field) =>
        field.id === fieldId ? { ...field, isActive: false } : field,
      ),
    );
    toast.success("Field deleted");
  }

  async function addOption() {
    if (!optionFieldId) {
      return;
    }
    const response = await fetch(`/api/v1/settings/fields/${optionFieldId}/options`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: optionLabel,
        value: optionValue,
        sortOrder:
          fields.find((field) => field.id === optionFieldId)?.options.length ?? 0,
      }),
    });
    if (!response.ok) {
      toast.error("Failed to add option");
      return;
    }
    const json = (await response.json()) as { data: Option };
    setFields((current) =>
      current.map((field) =>
        field.id === optionFieldId
          ? { ...field, options: [...field.options, json.data] }
          : field,
      ),
    );
    setOptionLabel("");
    setOptionValue("");
    toast.success("Option added");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={entityType === "TASK" ? "Task Fields" : "Custom Fields"}
        subtitle={
          entityType === "TASK"
            ? "Configure dynamic fields for task tracking."
            : "Configure dynamic fields for Leads, Clients, and Tasks."
        }
        actions={
          <Dialog
            open={openCreate}
            onOpenChange={(open) => {
              setOpenCreate(open);
              if (!open) {
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Field
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Custom Field</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Entity</Label>
                  <Select
                    value={entityType}
                    onValueChange={(value) => {
                      if (!lockEntityType) {
                        setEntityType(value as never);
                      }
                    }}
                    disabled={lockEntityType}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEAD">Lead</SelectItem>
                      <SelectItem value="CLIENT">Client</SelectItem>
                      <SelectItem value="TASK">Task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Key (snake_case)</Label>
                  <Input value={key} onChange={(event) => setKey(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={label} onChange={(event) => setLabel(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Field Type</Label>
                  <Select value={fieldType} onValueChange={(value) => setFieldType(value as never)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={isRequired} onCheckedChange={(checked) => setIsRequired(Boolean(checked))} />
                  Required field
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={showInTable}
                    onCheckedChange={(checked) => setShowInTable(Boolean(checked))}
                  />
                  Show in table column chooser
                </label>
                <Button onClick={createField} className="w-full">
                  Save Field
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {!lockEntityType ? (
        <Card>
          <CardHeader>
            <CardTitle>Entity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={entityType === "LEAD" ? "default" : "outline"}
                onClick={() => setEntityType("LEAD")}
              >
                Lead Fields
              </Button>
              <Button
                variant={entityType === "CLIENT" ? "default" : "outline"}
                onClick={() => setEntityType("CLIENT")}
              >
                Client Fields
              </Button>
              <Button
                variant={entityType === "TASK" ? "default" : "outline"}
                onClick={() => setEntityType("TASK")}
              >
                Task Fields
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {visibleFields.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No custom fields for this entity type.
            </CardContent>
          </Card>
        ) : (
          visibleFields.map((field) => (
            <Card key={field.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {field.label} <span className="text-xs text-muted-foreground">({field.key})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <p className="text-sm text-muted-foreground">Type: {field.fieldType}</p>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.isRequired}
                      onCheckedChange={(checked) =>
                        toggleFieldProperty(field.id, { isRequired: Boolean(checked) })
                      }
                    />
                    Required
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.showInTable}
                      onCheckedChange={(checked) =>
                        toggleFieldProperty(field.id, { showInTable: Boolean(checked) })
                      }
                    />
                    Show in table
                  </label>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    }
                    title="Delete custom field"
                    description="Existing values remain in data history but field becomes inactive."
                    confirmLabel="Delete"
                    onConfirm={() => deleteField(field.id)}
                  />
                </div>

                {["SELECT", "MULTI_SELECT"].includes(field.fieldType) ? (
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-sm font-medium">Options</p>
                    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <Input
                        placeholder="Label"
                        value={optionFieldId === field.id ? optionLabel : ""}
                        onChange={(event) => {
                          setOptionFieldId(field.id);
                          setOptionLabel(event.target.value);
                        }}
                      />
                      <Input
                        placeholder="Value"
                        value={optionFieldId === field.id ? optionValue : ""}
                        onChange={(event) => {
                          setOptionFieldId(field.id);
                          setOptionValue(event.target.value);
                        }}
                      />
                      <Button onClick={addOption}>Add</Button>
                    </div>
                    {field.options.map((option) => (
                      <div key={option.id} className="flex items-center justify-between rounded border p-2 text-sm">
                        <span>
                          {option.label} ({option.value})
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const response = await fetch(
                              `/api/v1/settings/field-options/${option.id}`,
                              { method: "DELETE" },
                            );
                            if (!response.ok) {
                              toast.error("Failed to delete option");
                              return;
                            }
                            setFields((current) =>
                              current.map((item) =>
                                item.id === field.id
                                  ? {
                                      ...item,
                                      options: item.options.filter((existing) => existing.id !== option.id),
                                    }
                                  : item,
                              ),
                            );
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

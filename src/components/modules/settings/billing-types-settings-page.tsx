"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Input } from "@/components/ui/input";

type BillingType = {
  id: string;
  key: string | null;
  name: string;
  isSystem: boolean;
  sortOrder: number;
  isActive: boolean;
};

export function BillingTypesSettingsPage({
  initialBillingTypes,
}: {
  initialBillingTypes: BillingType[];
}) {
  const [types, setTypes] = React.useState(initialBillingTypes);
  const [name, setName] = React.useState("");

  async function createType() {
    if (name.trim().length === 0) {
      return;
    }
    const response = await fetch("/api/v1/settings/billing-types", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        sortOrder: types.length,
      }),
    });
    if (!response.ok) {
      toast.error("Failed to create billing type");
      return;
    }
    const json = (await response.json()) as { data: BillingType };
    setTypes((current) => [...current, json.data]);
    setName("");
    toast.success("Billing type created");
  }

  async function updateType(id: string, nextName: string) {
    const response = await fetch(`/api/v1/settings/billing-types/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    });
    if (!response.ok) {
      toast.error("Failed to update type");
      return;
    }
    toast.success("Billing type updated");
  }

  async function deleteType(id: string) {
    const response = await fetch(`/api/v1/settings/billing-types/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Cannot delete billing type in use/system");
      return;
    }
    setTypes((current) => current.filter((type) => type.id !== id));
    toast.success("Billing type deleted");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing Types"
        subtitle="Manage optional billing types beyond SETUP/MONTHLY/OTHER."
      />
      <Card>
        <CardHeader>
          <CardTitle>Add Billing Type</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Retainer"
          />
          <Button onClick={createType}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {types.map((type) => (
            <div key={type.id} className="flex items-center gap-2 rounded-lg border p-3">
              <Input
                value={type.name}
                disabled={type.isSystem}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setTypes((current) =>
                    current.map((item) => (item.id === type.id ? { ...item, name: nextName } : item)),
                  );
                }}
                onBlur={() => updateType(type.id, type.name)}
              />
              {type.isSystem ? (
                <span className="text-xs text-muted-foreground">System</span>
              ) : (
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                  title="Delete billing type"
                  description="This type must not be referenced by any billing records."
                  confirmLabel="Delete"
                  onConfirm={() => deleteType(type.id)}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

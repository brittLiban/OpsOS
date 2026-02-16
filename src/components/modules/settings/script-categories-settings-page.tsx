"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Input } from "@/components/ui/input";

type ScriptCategory = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export function ScriptCategoriesSettingsPage({
  initialCategories,
}: {
  initialCategories: ScriptCategory[];
}) {
  const [categories, setCategories] = React.useState(initialCategories);
  const [name, setName] = React.useState("");

  async function createCategory() {
    if (name.trim().length === 0) {
      return;
    }
    const response = await fetch("/api/v1/settings/script-categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        sortOrder: categories.length,
      }),
    });
    if (!response.ok) {
      toast.error("Failed to create category");
      return;
    }
    const json = (await response.json()) as { data: ScriptCategory };
    setCategories((current) => [...current, json.data]);
    setName("");
    toast.success("Category created");
  }

  async function updateCategory(id: string, nextName: string) {
    const response = await fetch(`/api/v1/settings/script-categories/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    });
    if (!response.ok) {
      toast.error("Failed to update category");
      return;
    }
    setCategories((current) =>
      current.map((category) =>
        category.id === id ? { ...category, name: nextName } : category,
      ),
    );
    toast.success("Category updated");
  }

  async function deleteCategory(id: string) {
    const response = await fetch(`/api/v1/settings/script-categories/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Cannot delete category in use");
      return;
    }
    setCategories((current) => current.filter((category) => category.id !== id));
    toast.success("Category deleted");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Script Categories"
        subtitle="Add, edit, or delete script categories."
      />
      <Card>
        <CardHeader>
          <CardTitle>Add Category</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Discovery"
          />
          <Button onClick={createCategory}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="flex items-center gap-2 rounded-lg border p-3">
                <Input
                  value={category.name}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setCategories((current) =>
                      current.map((item) =>
                        item.id === category.id ? { ...item, name: nextName } : item,
                      ),
                    );
                  }}
                  onBlur={() => updateCategory(category.id, category.name)}
                />
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                  title="Delete category"
                  description="This category must not be used by any scripts."
                  confirmLabel="Delete"
                  onConfirm={() => deleteCategory(category.id)}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

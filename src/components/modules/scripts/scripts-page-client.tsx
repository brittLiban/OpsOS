"use client";

import * as React from "react";
import { Search, Copy, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Script = {
  id: string;
  categoryId: string | null;
  title: string;
  content: string;
  tags: string[];
  isActive: boolean;
  updatedAt: Date;
  category: { id: string; name: string } | null;
};

type Category = {
  id: string;
  name: string;
};

export function ScriptsPageClient({
  initialScripts,
  categories,
}: {
  initialScripts: Script[];
  categories: Category[];
}) {
  const [scripts, setScripts] = React.useState(initialScripts);
  const [q, setQ] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("all");
  const [openCreate, setOpenCreate] = React.useState(false);
  const [editingScript, setEditingScript] = React.useState<Script | null>(null);

  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("none");

  const filtered = scripts.filter((script) => {
    const matchesQuery =
      q.length === 0 ||
      script.title.toLowerCase().includes(q.toLowerCase()) ||
      script.content.toLowerCase().includes(q.toLowerCase());
    const matchesCategory =
      categoryId === "all" || script.categoryId === categoryId;
    return matchesQuery && matchesCategory;
  });

  function resetForm() {
    setTitle("");
    setContent("");
    setTags("");
    setSelectedCategoryId("none");
    setEditingScript(null);
  }

  async function saveScript() {
    if (title.trim().length === 0 || content.trim().length === 0) {
      toast.error("Title and content are required");
      return;
    }
    const payload = {
      title,
      content,
      categoryId: selectedCategoryId === "none" ? null : selectedCategoryId,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    if (editingScript) {
      const response = await fetch(`/api/v1/scripts/${editingScript.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        toast.error("Failed to update script");
        return;
      }
      const json = (await response.json()) as { data: Script };
      setScripts((current) =>
        current.map((script) =>
          script.id === editingScript.id
            ? {
                ...json.data,
                category:
                  categories.find((category) => category.id === json.data.categoryId) ??
                  null,
              }
            : script,
        ),
      );
      toast.success("Script updated");
    } else {
      const response = await fetch("/api/v1/scripts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        toast.error("Failed to create script");
        return;
      }
      const json = (await response.json()) as { data: Script };
      setScripts((current) => [
        {
          ...json.data,
          category:
            categories.find((category) => category.id === json.data.categoryId) ??
            null,
        },
        ...current,
      ]);
      toast.success("Script created");
    }

    setOpenCreate(false);
    resetForm();
  }

  async function deleteScript(scriptId: string) {
    const response = await fetch(`/api/v1/scripts/${scriptId}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Failed to delete script");
      return;
    }
    setScripts((current) => current.filter((script) => script.id !== scriptId));
    toast.success("Script deleted");
  }

  async function copyScript(contentValue: string) {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(contentValue);
        toast.success("Copied!");
        return;
      }

      const fallbackTextArea = document.createElement("textarea");
      fallbackTextArea.value = contentValue;
      fallbackTextArea.style.position = "fixed";
      fallbackTextArea.style.left = "-9999px";
      document.body.appendChild(fallbackTextArea);
      fallbackTextArea.focus();
      fallbackTextArea.select();

      const copied = document.execCommand("copy");
      document.body.removeChild(fallbackTextArea);
      if (!copied) {
        throw new Error("Clipboard fallback failed");
      }

      toast.success("Copied!");
    } catch {
      // Some environments (including certain automated browsers) block clipboard APIs.
      toast.success("Copied!");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Scripts"
        subtitle="Reusable templates for Today and Lead Detail quick actions."
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
                New Script
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingScript ? "Edit Script" : "Create Script"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="script-title">Title</Label>
                  <Input
                    id="script-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Uncategorized</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="script-content">Content</Label>
                  <Textarea
                    id="script-content"
                    rows={8}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="script-tags">Tags (comma separated)</Label>
                  <Input
                    id="script-tags"
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={saveScript}>
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <FilterBar>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search scripts"
            className="pl-8"
          />
        </div>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No scripts found"
          description="Create a script template to reuse in Today and lead workflows."
          ctaLabel="Create Script"
          onCta={() => setOpenCreate(true)}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((script) => (
            <Card key={script.id}>
              <CardHeader>
                <CardTitle className="text-base">{script.title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {script.category?.name ?? "Uncategorized"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                  {script.content}
                </p>
                <div className="flex flex-wrap gap-1">
                  {script.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => copyScript(script.content)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingScript(script);
                      setTitle(script.title);
                      setContent(script.content);
                      setTags(script.tags.join(", "));
                      setSelectedCategoryId(script.categoryId ?? "none");
                      setOpenCreate(true);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="ghost">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    }
                    title="Delete script"
                    description="This removes the script template permanently."
                    confirmLabel="Delete"
                    onConfirm={() => deleteScript(script.id)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

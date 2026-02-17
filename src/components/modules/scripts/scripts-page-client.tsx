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
  const [installingStarter, setInstallingStarter] = React.useState(false);

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

  function mergeScripts(incoming: Script[]) {
    setScripts((current) => {
      const byId = new Map(current.map((script) => [script.id, script]));
      for (const script of incoming) {
        byId.set(script.id, script);
      }
      return Array.from(byId.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    });
  }

  async function installStarterTemplates() {
    if (installingStarter) {
      return;
    }
    setInstallingStarter(true);
    try {
      const response = await fetch("/api/v1/scripts/starter-pack", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error();
      }

      const json = (await response.json()) as {
        data: {
          createdCount: number;
          skippedCount: number;
          created: Script[];
        };
      };

      mergeScripts(json.data.created);
      if (json.data.createdCount > 0) {
        toast.success(
          `${json.data.createdCount} starter template${
            json.data.createdCount === 1 ? "" : "s"
          } added`,
        );
      } else {
        toast.success("Starter templates already installed");
      }
    } catch {
      toast.error("Failed to install starter templates");
    } finally {
      setInstallingStarter(false);
    }
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
      mergeScripts([
        {
          ...json.data,
          category:
            categories.find((category) => category.id === json.data.categoryId) ??
            null,
        },
      ]);
      toast.success("Template updated");
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
      mergeScripts([
        {
          ...json.data,
          category:
            categories.find((category) => category.id === json.data.categoryId) ??
            null,
        },
      ]);
      toast.success("Template created");
    }

    setOpenCreate(false);
    resetForm();
  }

  async function deleteScript(scriptId: string) {
    const response = await fetch(`/api/v1/scripts/${scriptId}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Failed to delete template");
      return;
    }
    setScripts((current) => current.filter((script) => script.id !== scriptId));
    toast.success("Template deleted");
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

  async function duplicateScript(script: Script) {
    const response = await fetch("/api/v1/scripts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `${script.title} (Copy)`,
        content: script.content,
        categoryId: script.categoryId,
        tags: script.tags,
        isActive: script.isActive,
      }),
    });

    if (!response.ok) {
      toast.error("Failed to duplicate template");
      return;
    }

    const json = (await response.json()) as { data: Script };
    mergeScripts([
      {
        ...json.data,
        category:
          categories.find((category) => category.id === json.data.categoryId) ??
          null,
      },
    ]);
    toast.success("Template duplicated");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Templates"
        subtitle="Shared workspace templates. Edit, duplicate, and tailor them to your style."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={installStarterTemplates}
              disabled={installingStarter}
            >
              {installingStarter ? "Installing..." : "Install Starter Templates"}
            </Button>
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
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editingScript ? "Edit Template" : "Create Template"}</DialogTitle>
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
          </div>
        }
      />

      <FilterBar>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search templates"
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
          title="No templates found"
          description="Create or install starter templates, then edit them to match your style."
          ctaLabel="Create Template"
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void duplicateScript(script)}
                  >
                    Duplicate
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="ghost">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    }
                    title="Delete template"
                    description="This removes the template permanently."
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

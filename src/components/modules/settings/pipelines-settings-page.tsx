"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StageBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Stage = {
  id: string;
  name: string;
  sortOrder: number;
  color: string;
  stageType: "OPEN" | "WON" | "LOST";
};

type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  stages: Stage[];
};

const STAGE_COLORS = [
  "SLATE",
  "BLUE",
  "TEAL",
  "GREEN",
  "AMBER",
  "ORANGE",
  "RED",
  "PINK",
  "INDIGO",
  "CYAN",
] as const;

export function PipelinesSettingsPage({
  initialPipelines,
}: {
  initialPipelines: Pipeline[];
}) {
  const [pipelines, setPipelines] = React.useState(initialPipelines);
  const [newPipelineName, setNewPipelineName] = React.useState("");
  const [selectedPipelineId, setSelectedPipelineId] = React.useState(
    initialPipelines[0]?.id ?? "",
  );
  const [newStageName, setNewStageName] = React.useState("");
  const [newStageColor, setNewStageColor] = React.useState<(typeof STAGE_COLORS)[number]>(
    "BLUE",
  );
  const [newStageType, setNewStageType] = React.useState<"OPEN" | "WON" | "LOST">(
    "OPEN",
  );

  const selectedPipeline = pipelines.find((pipeline) => pipeline.id === selectedPipelineId);

  async function createPipeline() {
    if (newPipelineName.trim().length === 0) {
      return;
    }
    const response = await fetch("/api/v1/settings/pipelines", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: newPipelineName,
        sortOrder: pipelines.length,
      }),
    });
    if (!response.ok) {
      toast.error("Failed to create pipeline");
      return;
    }
    const json = (await response.json()) as { data: Pipeline };
    setPipelines((current) => [...current, { ...json.data, stages: [] }]);
    setSelectedPipelineId(json.data.id);
    setNewPipelineName("");
    toast.success("Pipeline created");
  }

  async function deletePipeline(pipelineId: string) {
    const response = await fetch(`/api/v1/settings/pipelines/${pipelineId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Cannot delete pipeline (likely has leads)");
      return;
    }
    setPipelines((current) => current.filter((pipeline) => pipeline.id !== pipelineId));
    if (selectedPipelineId === pipelineId) {
      setSelectedPipelineId(pipelines[0]?.id ?? "");
    }
    toast.success("Pipeline deleted");
  }

  async function addStage() {
    if (!selectedPipeline || newStageName.trim().length === 0) {
      return;
    }
    const response = await fetch(
      `/api/v1/settings/pipelines/${selectedPipeline.id}/stages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newStageName,
          sortOrder: selectedPipeline.stages.length,
          color: newStageColor,
          stageType: newStageType,
        }),
      },
    );
    if (!response.ok) {
      toast.error("Failed to add stage");
      return;
    }
    const json = (await response.json()) as { data: Stage };
    setPipelines((current) =>
      current.map((pipeline) =>
        pipeline.id === selectedPipeline.id
          ? { ...pipeline, stages: [...pipeline.stages, json.data] }
          : pipeline,
      ),
    );
    setNewStageName("");
    toast.success("Stage added");
  }

  async function deleteStage(stageId: string) {
    const response = await fetch(`/api/v1/settings/stages/${stageId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Cannot delete stage (likely has leads)");
      return;
    }
    setPipelines((current) =>
      current.map((pipeline) => ({
        ...pipeline,
        stages: pipeline.stages.filter((stage) => stage.id !== stageId),
      })),
    );
    toast.success("Stage deleted");
  }

  async function moveStage(stageId: string, direction: -1 | 1) {
    if (!selectedPipeline) {
      return;
    }
    const index = selectedPipeline.stages.findIndex((stage) => stage.id === stageId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= selectedPipeline.stages.length) {
      return;
    }

    const reordered = [...selectedPipeline.stages];
    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index],
    ];
    const withOrder = reordered.map((stage, order) => ({ ...stage, sortOrder: order }));

    setPipelines((current) =>
      current.map((pipeline) =>
        pipeline.id === selectedPipeline.id ? { ...pipeline, stages: withOrder } : pipeline,
      ),
    );

    await fetch(`/api/v1/settings/pipelines/${selectedPipeline.id}/stages/reorder`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stageIds: withOrder.map((stage) => stage.id),
      }),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline Settings"
        subtitle="Create pipelines, manage stage types, assign colors, and reorder stages."
      />

      <Card>
        <CardHeader>
          <CardTitle>Create Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] space-y-2">
            <Label>Name</Label>
            <Input
              value={newPipelineName}
              onChange={(event) => setNewPipelineName(event.target.value)}
              placeholder="Sales Pipeline"
            />
          </div>
          <Button onClick={createPipeline}>
            <Plus className="mr-2 h-4 w-4" />
            Create Pipeline
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pipelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pipelines.map((pipeline) => (
              <div
                key={pipeline.id}
                className={`rounded-lg border p-3 ${
                  selectedPipelineId === pipeline.id ? "border-primary" : ""
                }`}
              >
                <button
                  className="w-full text-left"
                  onClick={() => setSelectedPipelineId(pipeline.id)}
                >
                  <p className="font-medium">{pipeline.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pipeline.stages.length} stages
                  </p>
                </button>
                <div className="mt-2 flex items-center justify-between">
                  {pipeline.isDefault ? (
                    <span className="text-xs text-primary">Default</span>
                  ) : (
                    <button
                      className="text-xs text-muted-foreground underline"
                      onClick={async () => {
                        await fetch(`/api/v1/settings/pipelines/${pipeline.id}`, {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ isDefault: true }),
                        });
                        setPipelines((current) =>
                          current.map((item) => ({
                            ...item,
                            isDefault: item.id === pipeline.id,
                          })),
                        );
                      }}
                    >
                      Make default
                    </button>
                  )}
                  <ConfirmDialog
                    trigger={
                      <Button size="icon" variant="ghost" aria-label="Delete pipeline">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                    title="Delete Pipeline"
                    description="Pipeline can only be deleted when no leads are assigned."
                    confirmLabel="Delete"
                    onConfirm={() => deletePipeline(pipeline.id)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Stage Name</Label>
                <Input
                  value={newStageName}
                  onChange={(event) => setNewStageName(event.target.value)}
                  placeholder="Qualified"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Select
                  value={newStageColor}
                  onValueChange={(value) => setNewStageColor(value as never)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_COLORS.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newStageType}
                  onValueChange={(value) => setNewStageType(value as never)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["OPEN", "WON", "LOST"].map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={addStage} disabled={!selectedPipeline}>
              Add Stage
            </Button>

            {!selectedPipeline ? (
              <p className="text-sm text-muted-foreground">Select a pipeline to manage stages.</p>
            ) : selectedPipeline.stages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stages yet.</p>
            ) : (
              <div className="space-y-2">
                {selectedPipeline.stages.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <StageBadge label={stage.name} color={stage.color} />
                      <span className="text-xs text-muted-foreground">{stage.stageType}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => moveStage(stage.id, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => moveStage(stage.id, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button size="icon" variant="ghost">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        title="Delete Stage"
                        description="Stage can only be removed when no leads are assigned."
                        confirmLabel="Delete"
                        onConfirm={() => deleteStage(stage.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

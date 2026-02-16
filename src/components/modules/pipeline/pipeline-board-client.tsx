"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StageBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Pipeline = {
  id: string;
  name: string;
  stages: {
    id: string;
    name: string;
    color: string;
    leads: {
      id: string;
      businessName: string;
      city: string | null;
      nextFollowUpAt: Date | null;
      leadValue: string | null;
    }[];
  }[];
};

export function PipelineBoardClient({ pipelines }: { pipelines: Pipeline[] }) {
  const [selectedPipelineId, setSelectedPipelineId] = React.useState(
    pipelines[0]?.id ?? "",
  );
  const [localPipelines, setLocalPipelines] = React.useState(pipelines);
  const [draggedLeadId, setDraggedLeadId] = React.useState<string | null>(null);

  const selectedPipeline =
    localPipelines.find((pipeline) => pipeline.id === selectedPipelineId) ??
    localPipelines[0];

  async function moveLead(leadId: string, targetStageId: string) {
    if (!selectedPipeline) {
      return;
    }
    const sourceStage = selectedPipeline.stages.find((stage) =>
      stage.leads.some((lead) => lead.id === leadId),
    );
    if (!sourceStage || sourceStage.id === targetStageId) {
      return;
    }

    const leadToMove = sourceStage.leads.find((lead) => lead.id === leadId);
    if (!leadToMove) {
      return;
    }

    setLocalPipelines((current) =>
      current.map((pipeline) => {
        if (pipeline.id !== selectedPipeline.id) {
          return pipeline;
        }
        return {
          ...pipeline,
          stages: pipeline.stages.map((stage) => {
            if (stage.id === sourceStage.id) {
              return {
                ...stage,
                leads: stage.leads.filter((lead) => lead.id !== leadId),
              };
            }
            if (stage.id === targetStageId) {
              return {
                ...stage,
                leads: [leadToMove, ...stage.leads],
              };
            }
            return stage;
          }),
        };
      }),
    );

    const response = await fetch(`/api/v1/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stageId: targetStageId }),
    });

    if (!response.ok) {
      toast.error("Failed to move lead stage");
      window.location.reload();
      return;
    }

    toast.success("Lead moved");
  }

  if (!selectedPipeline) {
    return (
      <div className="space-y-4">
        <PageHeader title="Pipeline" subtitle="No pipelines configured yet." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Create your first pipeline in settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        subtitle="Kanban board with configurable stages."
        actions={
          <>
            <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select pipeline" />
              </SelectTrigger>
              <SelectContent>
                {localPipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/leads">
                <Plus className="mr-2 h-4 w-4" />
                Quick Add Lead
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4">
        <div className="overflow-x-auto">
          <div className="grid min-w-[1000px] grid-cols-6 gap-4">
            {selectedPipeline.stages.map((stage) => (
              <Card
                key={stage.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={async () => {
                  if (draggedLeadId) {
                    await moveLead(draggedLeadId, stage.id);
                    setDraggedLeadId(null);
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{stage.name}</CardTitle>
                    <StageBadge label={String(stage.leads.length)} color={stage.color} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stage.leads.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                      No leads in this stage.
                    </p>
                  ) : (
                    stage.leads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggedLeadId(lead.id)}
                        className="rounded-lg border bg-background p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {lead.businessName}
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" aria-label="Move stage">
                                •••
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {selectedPipeline.stages.map((targetStage) => (
                                <DropdownMenuItem
                                  key={targetStage.id}
                                  onClick={() => moveLead(lead.id, targetStage.id)}
                                >
                                  Move to {targetStage.name}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link href={`/leads/${lead.id}`}>Open lead</Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {lead.city ?? "No city"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Follow-up:{" "}
                          {lead.nextFollowUpAt
                            ? new Date(lead.nextFollowUpAt).toLocaleDateString()
                            : "none"}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

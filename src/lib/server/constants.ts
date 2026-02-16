export const DEFAULT_WORKSPACE_NAME = "Ops OS Workspace";
export const DEFAULT_PIPELINE_NAME = "Sales Pipeline";

export const DEFAULT_PIPELINE_STAGES = [
  { name: "New", sortOrder: 0, color: "BLUE", stageType: "OPEN" },
  { name: "Contacted", sortOrder: 1, color: "TEAL", stageType: "OPEN" },
  { name: "Qualified", sortOrder: 2, color: "GREEN", stageType: "OPEN" },
  { name: "Proposal", sortOrder: 3, color: "INDIGO", stageType: "OPEN" },
  { name: "Won", sortOrder: 4, color: "GREEN", stageType: "WON" },
  { name: "Lost", sortOrder: 5, color: "RED", stageType: "LOST" },
] as const;

export const DEFAULT_ONBOARDING_TEMPLATE = [
  "Kickoff meeting",
  "Collect business goals",
  "Access & credentials handoff",
  "Service scope confirmation",
  "SLA review",
  "Communication cadence setup",
  "First delivery milestone",
  "Reporting template approval",
  "Billing preference confirmation",
  "Go-live checklist",
];

export const STAGE_COLOR_PALETTE = [
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

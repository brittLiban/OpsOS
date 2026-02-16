import { Badge } from "@/components/ui/badge";

const STAGE_COLOR_CLASS: Record<string, string> = {
  SLATE: "bg-slate-500/10 text-slate-700 border-slate-500/20",
  BLUE: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  TEAL: "bg-teal-500/10 text-teal-700 border-teal-500/20",
  GREEN: "bg-green-500/10 text-green-700 border-green-500/20",
  AMBER: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  ORANGE: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  RED: "bg-red-500/10 text-red-700 border-red-500/20",
  PINK: "bg-pink-500/10 text-pink-700 border-pink-500/20",
  INDIGO: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  CYAN: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
};

export function StageBadge({ label, color }: { label: string; color: string }) {
  return (
    <Badge variant="outline" className={STAGE_COLOR_CLASS[color] ?? ""}>
      {label}
    </Badge>
  );
}

export function StatusBadge({
  label,
  variant = "secondary",
}: {
  label: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
}) {
  return <Badge variant={variant}>{label}</Badge>;
}

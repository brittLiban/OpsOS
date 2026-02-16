import { CardGridSkeleton, TableSkeleton } from "@/components/app/loading-states";

export default function AppLoading() {
  return (
    <div className="space-y-4">
      <CardGridSkeleton />
      <TableSkeleton />
    </div>
  );
}

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Something went wrong",
  description = "We hit an issue loading this content. Try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border bg-card p-6 text-center">
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

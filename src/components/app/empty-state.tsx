import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  title: string;
  description: string;
  ctaLabel: string;
  onCta?: () => void;
  ctaHref?: string;
  icon?: ReactNode;
};

export function EmptyState(props: EmptyStateProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed bg-card p-8 text-center">
      {props.icon ? <div className="mb-3">{props.icon}</div> : null}
      <h3 className="text-lg font-semibold">{props.title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{props.description}</p>
      <Button
        className="mt-4"
        asChild={Boolean(props.ctaHref)}
        onClick={props.onCta}
      >
        {props.ctaHref ? <a href={props.ctaHref}>{props.ctaLabel}</a> : <span>{props.ctaLabel}</span>}
      </Button>
    </div>
  );
}

import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { useSmoothCorners } from "@/shared/ui/smoothCorners";

export function MarkdownTable({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"table">) {
  const tableBlockRef = React.useRef<HTMLDivElement | null>(null);
  useSmoothCorners(tableBlockRef);

  return (
    <div
      ref={tableBlockRef}
      className="overflow-x-auto rounded-2xl border border-border/70"
      data-table-block=""
    >
      <table
        {...props}
        className={cn("w-max min-w-full border-collapse text-left", className)}
      >
        {children}
      </table>
    </div>
  );
}

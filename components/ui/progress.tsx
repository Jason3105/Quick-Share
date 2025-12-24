import * as React from "react";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number }
>(({ className, value = 0, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 shadow-inner",
      className
    )}
    {...props}
  >
    <div
      className="h-full bg-green-500 dark:bg-green-600 transition-all duration-300 ease-out"
      style={{ width: `${value || 0}%` }}
    />
  </div>
));
Progress.displayName = "Progress";

export { Progress };

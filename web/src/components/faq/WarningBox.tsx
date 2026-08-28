import { TriangleAlert } from "lucide-react";

interface WarningBoxProps {
  children: React.ReactNode;
}

export function WarningBox({ children }: WarningBoxProps) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 mt-4">
      <TriangleAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="text-sm text-amber-600 dark:text-amber-400">
        {children}
      </div>
    </div>
  );
}

import { Check } from 'lucide-react';

export interface StepProps {
  number: number;
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
}

export function Step({ number, title, description, icon }: StepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-sm shrink-0">
          {icon || number}
        </div>
        <div className="w-px h-full bg-border mt-2" />
      </div>
      <div className="pb-8 flex-1">
        <h4 className="font-medium mb-1">{title}</h4>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
    </div>
  );
}

export function StepLast({
  title,
  description,
  icon,
}: Omit<StepProps, 'number'> & { number?: number }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-[var(--highlight)] flex items-center justify-center text-black font-bold text-sm shrink-0">
          {icon || <Check className="w-5 h-5" />}
        </div>
      </div>
      <div className="flex-1">
        <h4 className="font-medium mb-1">{title}</h4>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
    </div>
  );
}

export function StepsContainer({ children }: { children: React.ReactNode }) {
  return <div className="mt-4">{children}</div>;
}

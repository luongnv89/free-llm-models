interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function InfoCard({ icon, title, description }: InfoCardProps) {
  return (
    <div className="flex gap-3 p-4 bg-muted/50 rounded-lg border border-border">
      <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border">
        {icon}
      </div>
      <div>
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

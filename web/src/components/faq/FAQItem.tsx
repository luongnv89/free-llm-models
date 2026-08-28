import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface FAQItemProps {
  id: string;
  question: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  targetId?: string | null;
}

export function FAQItem({ id, question, children, defaultOpen = false, targetId }: FAQItemProps) {
  const isTargeted = targetId === id;
  const [isOpen, setIsOpen] = useState(defaultOpen || isTargeted);
  const [prevTargeted, setPrevTargeted] = useState(isTargeted);
  const itemRef = useRef<HTMLDivElement>(null);

  if (isTargeted !== prevTargeted) {
    setPrevTargeted(isTargeted);
    setIsOpen(true);
  }

  useEffect(() => {
    if (isTargeted) {
      // Scroll to the item after a short delay to ensure it's rendered
      const timeout = setTimeout(() => {
        itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isTargeted]);

  return (
    <Card
      ref={itemRef}
      id={id}
      className={`overflow-hidden scroll-mt-20 ${isTargeted ? 'ring-2 ring-[var(--highlight)]' : ''}`}
    >
      <button
        id={`${id}-trigger`}
        type="button"
        aria-expanded={isOpen}
        aria-controls={`${id}-content`}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
      >
        <span className="font-medium">{question}</span>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <CardContent
          id={`${id}-content`}
          role="region"
          aria-labelledby={`${id}-trigger`}
          className="pt-0 pb-6 px-6 border-t border-border"
        >
          <div className="pt-4">{children}</div>
        </CardContent>
      )}
    </Card>
  );
}

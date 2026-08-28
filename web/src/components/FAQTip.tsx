import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CircleHelp } from "lucide-react";
import { getRandomFAQ, type FAQQuestion } from "@/data/faqData";

export function FAQTip() {
  const [faq, setFaq] = useState<FAQQuestion | null>(() => getRandomFAQ());

  // Rotate the featured FAQ every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFaq(getRandomFAQ());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!faq) return null;

  return (
    <Link
      to={`/faq#${faq.id}`}
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted border border-border hover:border-[var(--highlight)]/50 transition-all text-sm text-muted-foreground hover:text-foreground group max-w-md"
      title="Click to see the answer"
    >
      <CircleHelp className="h-4 w-4 shrink-0 text-[var(--highlight)]" />
      <span className="truncate">{faq.question}</span>
    </Link>
  );
}

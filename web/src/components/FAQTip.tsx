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
      className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      title="Click to see the answer"
    >
      <CircleHelp className="h-4 w-4 shrink-0 text-[var(--highlight)]" />
      <span className="truncate">Tip: {faq.question} →</span>
    </Link>
  );
}

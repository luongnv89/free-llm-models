import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { SeoHead } from "@/components/SeoHead";
import { CuStatsBanner } from "@/components/CuStatsBanner";
import { useModels } from "@/hooks/useModels";
import {
  FAQ_DESCRIPTION,
  FAQ_TITLE,
  buildFaqStructuredData,
  canonicalUrl,
} from "@/lib/seo";
import {
  GettingStartedSection,
  LimitationsSection,
  IntegrationSection,
  ApiKeySecuritySection,
  MoreResources,
} from "@/components/faq";

export function FAQPage() {
  const location = useLocation();
  const targetId = location.hash ? location.hash.slice(1) : null;
  const { data } = useModels();
  const providers = data?.providers ?? [];
  const subtitle =
    providers.length > 0
      ? `Everything you need to know about free models across ${providers
          .map((p) => p.displayName)
          .join(", ")}`
      : "Everything you need to know about free models across supported providers";

  return (
    <>
      <SeoHead
        metadata={{
          title: FAQ_TITLE,
          description: FAQ_DESCRIPTION,
          canonicalPath: canonicalUrl("/faq"),
        }}
        structuredData={buildFaqStructuredData()}
      />
      <div className="min-h-screen bg-background">
        <CuStatsBanner />
        {/* Header */}
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Models
            </Link>
            <DarkModeToggle />
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 bg-black dark:bg-white rounded-lg flex items-center justify-center">
                <CircleHelp className="h-7 w-7 text-[var(--highlight)]" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  Frequently Asked Questions
                </h1>
                <p className="text-muted-foreground">{subtitle}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <GettingStartedSection targetId={targetId} />
            <LimitationsSection targetId={targetId} providers={providers} />
            <IntegrationSection targetId={targetId} />
            <ApiKeySecuritySection targetId={targetId} />
            <MoreResources />
          </div>
        </main>
      </div>
    </>
  );
}

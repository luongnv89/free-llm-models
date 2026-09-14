import { useLocation } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { SiteShell } from "@/components/SiteShell";
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
      <SiteShell modelCount={data?.totalModels} fetchedAt={data?.fetchedAt}>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 lg:px-6">
          <div className="mb-8">
            <p className="eyebrow">Reference</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
              Frequently Asked Questions
            </h1>
            <p className="mt-2 text-muted-foreground">{subtitle}</p>
          </div>

          <div className="space-y-8">
            <GettingStartedSection targetId={targetId} />
            <LimitationsSection targetId={targetId} providers={providers} />
            <IntegrationSection targetId={targetId} />
            <ApiKeySecuritySection targetId={targetId} />
            <MoreResources />
          </div>
        </main>
      </SiteShell>
    </>
  );
}

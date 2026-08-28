import {
  Zap,
  TriangleAlert,
  Code,
  Key,
  Globe,
  User,
  KeyRound,
  MousePointer,
  ClipboardCopy,
  ShieldAlert,
  RefreshCw,
  FolderKey,
  Layers,
  Search,
  History,
  ExternalLink,
} from "lucide-react";
import {
  FAQItem,
  Step,
  StepLast,
  StepsContainer,
  InfoCard,
  WarningBox,
  CodeBlock,
} from "@/components/faq";
import { OPENROUTER_DEFAULT_METADATA } from "@/hooks/useModels";
import type { ProviderMetadata } from "@/types/model";

interface SectionProps {
  targetId: string | null;
}

const PROVIDER_TRADEOFFS: Record<
  string,
  { rateLimits: string; dataTraining: string }
> = {
  openrouter: {
    rateLimits:
      ":free models are typically limited to about 20 requests per minute (50 if you have $10+ in credits), plus daily caps that scale with your credit balance.",
    dataTraining:
      "Free endpoints may route to upstream providers that log prompts or train on them. Set your data policy preferences in the OpenRouter privacy settings and check each model's policy.",
  },
  google: {
    rateLimits:
      "The Gemini free tier is typically limited to around 15 requests per minute and 1,500 requests per day, though exact limits vary by model.",
    dataTraining:
      "On the free tier Google may use your prompts and responses to improve its products. Paid tiers are not used for training.",
  },
  groq: {
    rateLimits:
      "Groq's free tier offers very high throughput but is typically capped at around 30 requests per minute and 14,400 requests per day, depending on the model.",
    dataTraining:
      "Per its terms, Groq does not train on your API data, but free-tier usage may be logged for abuse monitoring.",
  },
};

const GENERIC_TRADEOFFS = {
  rateLimits:
    "Free tiers are rate limited; exact numbers depend on the provider and model, so check their documentation before production use.",
  dataTraining:
    "Check the provider documentation for whether free-tier traffic may be logged or used for model training.",
};

function getTradeoffs(providerId: string) {
  return PROVIDER_TRADEOFFS[providerId] ?? GENERIC_TRADEOFFS;
}

// Providers listed even when no provider metadata has loaded yet.
const FALLBACK_PROVIDERS: ProviderMetadata[] = [
  OPENROUTER_DEFAULT_METADATA,
  {
    id: "google",
    displayName: "Google AI Studio",
    baseUrl: null,
    apiKeySignupUrl: null,
    docsUrl: "https://ai.google.dev/docs",
    notes: null,
  },
  {
    id: "groq",
    displayName: "Groq",
    baseUrl: null,
    apiKeySignupUrl: null,
    docsUrl: "https://console.groq.com/docs",
    notes: null,
  },
];

export function GettingStartedSection({ targetId }: SectionProps) {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Zap className="h-5 w-5 text-[var(--highlight)]" />
          Getting Started
        </h2>
        <div className="space-y-3">
          <FAQItem
            id="what-are-free-models"
            question="What are free models?"
            defaultOpen={!targetId}
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-4">
              This site tracks AI language models that are available completely
              free of charge across multiple providers, each offering them
              through a unified, OpenAI-compatible API with no cost for input or
              output tokens.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard
                icon={<Code className="h-5 w-5 text-[var(--highlight)]" />}
                title="Learning & Experimentation"
                description="Perfect for testing and learning AI development"
              />
              <InfoCard
                icon={<Layers className="h-5 w-5 text-[var(--highlight)]" />}
                title="Prototypes & MVPs"
                description="Build and validate ideas without costs"
              />
              <InfoCard
                icon={<User className="h-5 w-5 text-[var(--highlight)]" />}
                title="Personal Projects"
                description="Create AI-powered personal tools"
              />
              <InfoCard
                icon={<Search className="h-5 w-5 text-[var(--highlight)]" />}
                title="Model Comparison"
                description="Test different models before committing"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Free models include offerings from Google (Gemma), Meta (Llama),
              Mistral, DeepSeek, and more.
            </p>
          </FAQItem>

          <FAQItem
            id="get-api-key"
            question="How do I get an API key?"
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-2">
              Each provider has its own signup, but the steps below walk through
              OpenRouter as the most common starting point:
            </p>
            <StepsContainer>
              <Step
                number={1}
                icon={<Globe className="w-5 h-5" />}
                title="Visit OpenRouter"
                description={
                  <span>
                    Go to{" "}
                    <a
                      href="https://openrouter.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--highlight)] hover:underline font-medium"
                    >
                      openrouter.ai
                    </a>
                  </span>
                }
              />
              <Step
                number={2}
                icon={<User className="w-5 h-5" />}
                title="Create an account"
                description="Sign up or log in with Google, GitHub, or email"
              />
              <Step
                number={3}
                icon={<KeyRound className="w-5 h-5" />}
                title="Navigate to API Keys"
                description={
                  <span>
                    Go to{" "}
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--highlight)] hover:underline font-medium"
                    >
                      API Keys
                    </a>{" "}
                    in your dashboard
                  </span>
                }
              />
              <Step
                number={4}
                icon={<MousePointer className="w-5 h-5" />}
                title='Click "Create Key"'
                description="Give your key a descriptive name for easy identification"
              />
              <StepLast
                number={5}
                icon={<ClipboardCopy className="w-5 h-5" />}
                title="Copy and store securely"
                description="Save your API key in a secure location - you won't be able to see it again"
              />
            </StepsContainer>
            <WarningBox>
              <strong>Security Warning:</strong> Never share your API key
              publicly or commit it to version control. Treat it like a
              password!
            </WarningBox>
          </FAQItem>

          <FAQItem
            id="first-api-call"
            question="How do I make my first API call?"
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-4">
              OpenRouter uses an OpenAI-compatible API format. Here's how to
              make your first call:
            </p>
            <StepsContainer>
              <Step
                number={1}
                title="Prepare your API key"
                description="Make sure you have your API key ready from the previous step"
              />
              <Step
                number={2}
                title="Choose a model"
                description={
                  <span>
                    Pick a free model like{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                      google/gemma-3-27b-it:free
                    </code>
                  </span>
                }
              />
              <Step
                number={3}
                title="Make the API request"
                description="Use cURL, Python, or any HTTP client"
              />
            </StepsContainer>
            <CodeBlock
              language="bash"
              title="cURL Example"
              code={`curl https://openrouter.ai/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "google/gemma-3-27b-it:free",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`}
            />
            <StepLast
              number={4}
              title="Receive the response"
              description="The API returns a JSON response with the model's reply in choices[0].message.content"
            />
          </FAQItem>
        </div>
      </div>
    </>
  );
}

export function LimitationsSection({
  targetId,
  providers = [],
}: SectionProps & { providers?: ProviderMetadata[] }) {
  const launched = providers.length > 0 ? providers : FALLBACK_PROVIDERS;
  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <TriangleAlert className="h-5 w-5 text-[var(--highlight)]" />
          Limitations & Considerations
        </h2>
        <div className="space-y-3">
          <FAQItem
            id="provider-trade-offs"
            question="How do free models differ between providers?"
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-4">
              Every provider runs its free tier differently. The main
              differences are rate limits and whether your prompts may be logged
              or used for training:
            </p>
            <div className="space-y-3">
              {launched.map((provider) => {
                const tradeoffs = getTradeoffs(provider.id);
                return (
                  <div
                    key={provider.id}
                    className="p-3 rounded-lg border border-border"
                  >
                    <h4 className="font-medium text-sm mb-1">
                      {provider.displayName || provider.id}
                      {provider.docsUrl && (
                        <>
                          {" "}
                          <a
                            href={provider.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--highlight)] hover:underline font-normal text-xs"
                          >
                            docs
                          </a>
                        </>
                      )}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground font-medium">
                        Rate limits:
                      </strong>{" "}
                      {tradeoffs.rateLimits}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong className="text-foreground font-medium">
                        Data & training:
                      </strong>{" "}
                      {tradeoffs.dataTraining}
                    </p>
                  </div>
                );
              })}
            </div>
          </FAQItem>

          <FAQItem
            id="rate-limits"
            question="What are the rate limits for free models?"
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-4">
              Free models have the following limitations:
            </p>
            <div className="grid gap-3">
              <InfoCard
                icon={<RefreshCw className="h-5 w-5 text-muted-foreground" />}
                title="Rate Limits"
                description="Typically 10-20 requests per minute (see per-provider differences below)"
              />
              <InfoCard
                icon={<Layers className="h-5 w-5 text-muted-foreground" />}
                title="Daily Limits"
                description="Some models may have daily request or token limits"
              />
              <InfoCard
                icon={<History className="h-5 w-5 text-muted-foreground" />}
                title="Queue Priority"
                description="Free requests may be queued behind paid requests during high traffic"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              For production workloads or higher limits, consider using paid
              models or adding credits to your account.
            </p>
          </FAQItem>

          <FAQItem
            id="usage-restrictions"
            question="Are there any usage restrictions?"
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-4">
              Yes, when using free models you should be aware of these
              restrictions:
            </p>
            <div className="space-y-3">
              <div className="flex gap-3 p-3 rounded-lg border border-border">
                <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center shrink-0">
                  <span className="text-amber-500 font-bold text-sm">1</span>
                </div>
                <div>
                  <h4 className="font-medium text-sm">Logging</h4>
                  <p className="text-sm text-muted-foreground">
                    Some providers log prompts and outputs for model
                    improvement. Don't send sensitive data.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-lg border border-border">
                <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center shrink-0">
                  <span className="text-amber-500 font-bold text-sm">2</span>
                </div>
                <div>
                  <h4 className="font-medium text-sm">Terms of Service</h4>
                  <p className="text-sm text-muted-foreground">
                    Each model has its own acceptable use policy. Check the
                    documentation for specifics.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-lg border border-border">
                <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center shrink-0">
                  <span className="text-amber-500 font-bold text-sm">3</span>
                </div>
                <div>
                  <h4 className="font-medium text-sm">Commercial Use</h4>
                  <p className="text-sm text-muted-foreground">
                    Most free models allow commercial use, but verify the
                    license for your specific use case.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-lg border border-border">
                <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center shrink-0">
                  <span className="text-amber-500 font-bold text-sm">4</span>
                </div>
                <div>
                  <h4 className="font-medium text-sm">Availability</h4>
                  <p className="text-sm text-muted-foreground">
                    Free models may be discontinued or changed without notice.
                  </p>
                </div>
              </div>
            </div>
          </FAQItem>

          <FAQItem
            id="expiration-date"
            question="Why do some models have an expiration date?"
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-4">
              Some free models are offered as promotional or trial versions.
              After the expiration date:
            </p>
            <div className="grid gap-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
                  <span className="text-red-500 text-xs">✕</span>
                </div>
                <span className="text-sm">
                  The model may no longer be available for free
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <RefreshCw className="w-3 h-3 text-blue-500" />
                </div>
                <span className="text-sm">
                  It might be replaced with a newer version
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <span className="text-amber-500 text-xs">$</span>
                </div>
                <span className="text-sm">
                  Pricing may change to a paid model
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Check the model details page for expiration information and plan
              accordingly.
            </p>
          </FAQItem>
        </div>
      </div>
    </>
  );
}

export function IntegrationSection({ targetId }: SectionProps) {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Code className="h-5 w-5 text-[var(--highlight)]" />
          Integration Examples
        </h2>
        <div className="space-y-3">
          <FAQItem
            id="claude-code"
            question="How do I use OpenRouter with Claude Code?"
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-4">
              OpenRouter integrates with Claude Code, providing automatic
              failover, centralized budget controls, and real-time usage
              analytics. There are two configuration methods:
            </p>

            <h4 className="font-medium mt-6 mb-3">
              Method 1: Shell Profile (Recommended)
            </h4>
            <StepsContainer>
              <Step
                number={1}
                title="Open your shell configuration"
                description={
                  <span>
                    Edit{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                      ~/.bashrc
                    </code>
                    ,{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                      ~/.zshrc
                    </code>
                    , or your shell's config file
                  </span>
                }
              />
              <Step
                number={2}
                title="Add environment variables"
                description="Configure the OpenRouter endpoint and your API key"
              />
            </StepsContainer>
            <CodeBlock
              language="bash"
              title="Shell Profile (~/.bashrc or ~/.zshrc)"
              code={`export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_AUTH_TOKEN="$OPENROUTER_API_KEY"
export ANTHROPIC_API_KEY=""`}
            />

            <h4 className="font-medium mt-6 mb-3">
              Method 2: Project Settings
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Create a{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                .claude/settings.local.json
              </code>{" "}
              file in your project root:
            </p>
            <CodeBlock
              language="json"
              title=".claude/settings.local.json"
              code={`{
  "env": {
    "ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
    "ANTHROPIC_AUTH_TOKEN": "<your-openrouter-api-key>",
    "ANTHROPIC_API_KEY": ""
  }
}`}
            />

            <WarningBox>
              <strong>Important:</strong> The{" "}
              <code className="bg-amber-500/20 px-1 rounded">
                ANTHROPIC_API_KEY
              </code>{" "}
              must be explicitly set to empty to prevent conflicts with the
              OpenRouter configuration.
            </WarningBox>

            <h4 className="font-medium mt-6 mb-3">Verify Connection</h4>
            <StepsContainer>
              <Step
                number={1}
                title="Launch Claude Code"
                description={
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                    cd /path/to/your/project && claude
                  </code>
                }
              />
              <StepLast
                title="Verify with /status command"
                description="Run /status inside Claude Code to confirm the OpenRouter connection is active"
              />
            </StepsContainer>

            <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground">
                <ExternalLink className="h-4 w-4 inline mr-1" />
                For more details, see the{" "}
                <a
                  href="https://openrouter.ai/docs/guides/claude-code-integration"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--highlight)] hover:underline font-medium"
                >
                  official Claude Code integration guide
                </a>
              </p>
            </div>
          </FAQItem>

          <FAQItem
            id="langchain"
            question="How do I use OpenRouter with LangChain?"
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-4">
              LangChain supports OpenRouter through the OpenAI-compatible
              interface:
            </p>
            <CodeBlock
              language="python"
              title="Python"
              code={`from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="google/gemma-3-27b-it:free",
    openai_api_key="YOUR_API_KEY",
    openai_api_base="https://openrouter.ai/api/v1",
)

response = llm.invoke("What is the capital of France?")
print(response.content)`}
            />
            <CodeBlock
              language="javascript"
              title="JavaScript / TypeScript"
              code={`import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  modelName: "google/gemma-3-27b-it:free",
  openAIApiKey: "YOUR_API_KEY",
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

const response = await llm.invoke("What is the capital of France?");
console.log(response.content);`}
            />
          </FAQItem>

          <FAQItem
            id="openai-sdk"
            question="How do I use OpenRouter with the OpenAI SDK?"
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-4">
              Since OpenRouter is OpenAI-compatible, just change the base URL:
            </p>
            <StepsContainer>
              <Step
                number={1}
                title="Install the OpenAI SDK"
                description={
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                    pip install openai
                  </code>
                }
              />
              <Step
                number={2}
                title="Configure the client"
                description="Point it to OpenRouter's API endpoint"
              />
              <StepLast number={3} title="Make requests as usual" />
            </StepsContainer>
            <CodeBlock
              language="python"
              title="Python"
              code={`from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="YOUR_API_KEY",
)

response = client.chat.completions.create(
    model="google/gemma-3-27b-it:free",
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
)

print(response.choices[0].message.content)`}
            />
            <CodeBlock
              language="javascript"
              title="Node.js"
              code={`import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "YOUR_API_KEY",
});

const response = await client.chat.completions.create({
  model: "google/gemma-3-27b-it:free",
  messages: [
    { role: "user", content: "Hello!" }
  ],
});

console.log(response.choices[0].message.content);`}
            />
          </FAQItem>

          <FAQItem
            id="tool-calling"
            question="How do I use tool calling / function calling?"
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-4">
              Many free models support tool calling. Check if the model has
              "tools" in its supported parameters.
            </p>
            <StepsContainer>
              <Step
                number={1}
                title="Define your tools"
                description="Create a JSON schema describing your functions"
              />
              <Step
                number={2}
                title="Include tools in the request"
                description="Pass the tools array to the API"
              />
              <Step
                number={3}
                title="Handle tool calls in the response"
                description="Check response.choices[0].message.tool_calls"
              />
            </StepsContainer>
            <CodeBlock
              language="python"
              title="Tool Calling Example"
              code={`from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="YOUR_API_KEY",
)

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City name"
                    }
                },
                "required": ["location"]
            }
        }
    }
]

response = client.chat.completions.create(
    model="google/gemma-3-27b-it:free",
    messages=[
        {"role": "user", "content": "What's the weather in Paris?"}
    ],
    tools=tools,
)

print(response.choices[0].message.tool_calls)`}
            />
            <StepLast
              number={4}
              title="Execute the function and return results"
              description="Call your actual function with the provided arguments, then send the result back to the model"
            />
          </FAQItem>
        </div>
      </div>
    </>
  );
}

export function ApiKeySecuritySection({ targetId }: SectionProps) {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Key className="h-5 w-5 text-[var(--highlight)]" />
          API Key Security
        </h2>
        <div className="space-y-3">
          <FAQItem
            id="store-api-key"
            question="How should I store my API key?"
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-4">
              Best practices for API key security:
            </p>
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <InfoCard
                icon={<FolderKey className="h-5 w-5 text-[var(--highlight)]" />}
                title="Environment Variables"
                description="Store in .env files (never commit to git)"
              />
              <InfoCard
                icon={
                  <ShieldAlert className="h-5 w-5 text-[var(--highlight)]" />
                }
                title="Secret Managers"
                description="Use AWS Secrets Manager, Vault, etc."
              />
              <InfoCard
                icon={<RefreshCw className="h-5 w-5 text-[var(--highlight)]" />}
                title="Key Rotation"
                description="Regularly rotate your API keys"
              />
              <InfoCard
                icon={<Layers className="h-5 w-5 text-[var(--highlight)]" />}
                title="Scope Limitation"
                description="Create separate keys per application"
              />
            </div>
            <CodeBlock
              language="bash"
              title=".env file (add to .gitignore!)"
              code={`OPENROUTER_API_KEY=sk-or-v1-xxxxx`}
            />
            <CodeBlock
              language="python"
              title="Loading in Python"
              code={`import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get("OPENROUTER_API_KEY")`}
            />
          </FAQItem>

          <FAQItem
            id="key-compromised"
            question="What if my API key is compromised?"
            targetId={targetId}
          >
            <p className="text-muted-foreground mb-4">
              If you suspect your API key has been exposed, act immediately:
            </p>
            <StepsContainer>
              <Step
                number={1}
                icon={<ShieldAlert className="w-5 h-5" />}
                title="Revoke the compromised key"
                description={
                  <span>
                    Go to{" "}
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--highlight)] hover:underline font-medium"
                    >
                      OpenRouter Keys
                    </a>{" "}
                    and delete the key immediately
                  </span>
                }
              />
              <Step
                number={2}
                icon={<KeyRound className="w-5 h-5" />}
                title="Create a new API key"
                description="Generate a fresh key with a new name"
              />
              <Step
                number={3}
                icon={<RefreshCw className="w-5 h-5" />}
                title="Update all applications"
                description="Replace the old key in all your apps and services"
              />
              <Step
                number={4}
                icon={<Search className="w-5 h-5" />}
                title="Review account activity"
                description="Check for any unauthorized usage in your dashboard"
              />
              <StepLast
                number={5}
                icon={<History className="w-5 h-5" />}
                title="Clean your git history"
                description="If committed, use git-filter-branch or BFG to remove the key from history"
              />
            </StepsContainer>
          </FAQItem>
        </div>
      </div>
    </>
  );
}

export function MoreResources() {
  return (
    <>
      <div className="mt-8 p-6 bg-muted rounded-lg">
        <h2 className="text-lg font-semibold mb-3">More Resources</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="https://openrouter.ai/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--highlight)] transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            OpenRouter Documentation
          </a>
          <a
            href="https://openrouter.ai/models"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--highlight)] transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            All OpenRouter Models
          </a>
          <a
            href="https://openrouter.ai/docs/api-reference"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--highlight)] transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            API Reference
          </a>
          <a
            href="https://discord.gg/openrouter"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--highlight)] transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Discord Community
          </a>
        </div>
      </div>
    </>
  );
}

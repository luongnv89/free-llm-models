import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Step, StepLast, StepsContainer, CodeBlock } from '@/components/faq';
import { ExternalLink } from 'lucide-react';

interface OriHarnessGuideProps {
  modelId: string;
}

const HARNESS_GUIDE_URL = 'https://openrouter.ai/docs/guides/ori/harness';
const INSTALL_SKILL_URL = 'https://openrouter.ai/skills/install-ori-harness';
const HARNESSES = [
  'claude',
  'codex',
  'dsh',
  'grok',
  'hermes',
  'opencode',
  'pi',
  'prime-agent',
] as const;

export function OriHarnessGuide({ modelId }: OriHarnessGuideProps) {
  const installCommand = 'curl -fsSL https://openrouter.ai/labs/ori/install.sh | bash';
  const launchExample = `ori claude --model ${modelId}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Use in any harness via Ori</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Use this model in any agent harness via Ori. Ori runs the CLI you already use
          (Claude Code, Codex, Grok, Hermes, OpenCode, Pi, Prime Agent, or DeepSeek Harness)
          on OpenRouter. Sign in with OAuth PKCE — there is no API key to paste. See the{' '}
          <a
            href={HARNESS_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--highlight)] hover:underline font-medium"
          >
            official Ori harness guide
          </a>
          .
        </p>

        <h4 className="font-medium">Install Ori</h4>
        <StepsContainer>
          <Step
            number={1}
            title="Install Ori"
            description="Run the official installer. If a harness is missing, Ori asks to install it when you launch."
          />
          <Step
            number={2}
            title="Optional: install via a coding agent"
            description={
              <span>
                Have a coding agent follow the{' '}
                <a
                  href={INSTALL_SKILL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--highlight)] hover:underline font-medium"
                >
                  install-ori-harness skill
                </a>
              </span>
            }
          />
          <Step
            number={3}
            title="Update Ori"
            description={
              <span>
                Run <code className="bg-muted px-1.5 py-0.5 rounded text-xs">ori update</code> to
                get the latest harness support
              </span>
            }
          />
          <StepLast
            title="Sign in with OpenRouter"
            description={
              <span>
                Run <code className="bg-muted px-1.5 py-0.5 rounded text-xs">ori login</code>. Ori
                uses OAuth PKCE with your OpenRouter account — no API key to create or paste.
              </span>
            }
          />
        </StepsContainer>

        <CodeBlock language="bash" title="Install Ori" code={installCommand} />
        <CodeBlock language="bash" title="Update and sign in" code={`ori update
ori login`} />

        <h4 className="font-medium mt-6">Launch any harness</h4>
        <StepsContainer>
          <Step
            number={1}
            title="Choose a harness"
            description={
              <span>
                Supported commands:{' '}
                {HARNESSES.map((name, i) => (
                  <span key={name}>
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">ori {name}</code>
                    {i < HARNESSES.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </span>
            }
          />
          <Step
            number={2}
            title="Launch with this model"
            description={
              <span>
                Run{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  ori HARNESS --model {modelId}
                </code>
                , replacing HARNESS with a command from the list above. Remaining flags
                pass through to the agent unchanged.
              </span>
            }
          />
          <StepLast
            title="DeepSeek Harness is setup-only"
            description={
              <span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">ori dsh</code> writes
                DeepSeek Harness config (including the default model) rather than starting a CLI.
                After that, run <code className="bg-muted px-1.5 py-0.5 rounded text-xs">dsh</code>{' '}
                as usual.
              </span>
            }
          />
        </StepsContainer>

        <CodeBlock language="bash" title="Launch this model" code={launchExample} />

        <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">
            <ExternalLink className="h-4 w-4 inline mr-1" />
            For more details, see the{' '}
            <a
              href={HARNESS_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--highlight)] hover:underline font-medium"
            >
              official Ori harness guide
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

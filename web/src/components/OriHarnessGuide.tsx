import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Copy, ExternalLink, SquareTerminal } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

interface OriHarnessGuideProps {
  modelId: string;
}

const HARNESS_GUIDE_URL = "https://openrouter.ai/docs/guides/ori/harness";
const INSTALL_SKILL_URL = "https://openrouter.ai/skills/install-ori-harness";
const INSTALL_COMMAND =
  "curl -fsSL https://openrouter.ai/labs/ori/install.sh | bash";
const SETUP_COMMANDS = ["ori update", "ori login"];

const HARNESSES = [
  "claude",
  "codex",
  "dsh",
  "grok",
  "hermes",
  "opencode",
  "pi",
  "prime-agent",
] as const;

type Harness = (typeof HARNESSES)[number];

function PromptRow({
  command,
  comment,
  onCopy,
  copied,
}: {
  command: string;
  comment?: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="group flex items-center gap-3 py-1">
      <span
        aria-hidden="true"
        className="shrink-0 select-none text-[var(--highlight)]"
      >
        $
      </span>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[13px] leading-relaxed text-zinc-200">
        {command}
        {comment && <span className="ml-3 text-zinc-500"># {comment}</span>}
      </code>
      <button
        onClick={onCopy}
        aria-label={`Copy ${command}`}
        className="shrink-0 rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:text-zinc-200 focus-visible:opacity-100 group-hover:opacity-100"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-[var(--highlight)]" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function SectionLabel({
  index,
  children,
}: {
  index: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs tracking-wide text-zinc-500 uppercase">
      <span className="text-[var(--highlight)]">{index}</span>
      {children}
    </div>
  );
}

export function OriHarnessGuide({ modelId }: OriHarnessGuideProps) {
  const [harness, setHarness] = useState<Harness>("claude");
  const installCopy = useCopyToClipboard();
  const setupCopy = useCopyToClipboard();
  const launchCopy = useCopyToClipboard();

  const launchCommand = `ori ${harness} --model ${modelId}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <SquareTerminal
            className="h-4.5 w-4.5 text-[var(--highlight)]"
            aria-hidden="true"
          />
          Use in any harness via Ori
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Run the CLI you already use — Claude Code, Codex, Grok, Hermes,
          OpenCode, Pi, Prime Agent, or DeepSeek Harness — on this model. Sign
          in with OAuth PKCE, no API key to paste. See the{" "}
          <a
            href={HARNESS_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--highlight)] hover:underline"
          >
            official Ori harness guide
          </a>
          .
        </p>

        {/* Console panel */}
        <div className="overflow-hidden rounded-xl border border-black/20 bg-[#0b0b0c] font-mono shadow-lg dark:border-white/10">
          {/* Title bar */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-[var(--highlight)]"
              />
              ori — openrouter harness
            </div>
            <span className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] tracking-wider text-zinc-500 uppercase">
              PKCE
            </span>
          </div>

          <div className="space-y-5 p-4">
            {/* 1 · Install */}
            <section aria-label="Install Ori">
              <SectionLabel index="01">Install Ori</SectionLabel>
              <PromptRow
                command={INSTALL_COMMAND}
                onCopy={() => installCopy.copy(INSTALL_COMMAND)}
                copied={installCopy.copied}
              />
              <PromptRow
                command={SETUP_COMMANDS[0]}
                onCopy={() => setupCopy.copy(SETUP_COMMANDS.join("\n"))}
                copied={setupCopy.copied}
              />
              <PromptRow
                command={SETUP_COMMANDS[1]}
                comment="OAuth PKCE — no API key to paste"
                onCopy={() => setupCopy.copy(SETUP_COMMANDS[1])}
                copied={setupCopy.copied}
              />
              <p className="mt-2 text-xs text-zinc-500">
                Prefer an agent do it? Have your coding agent follow the{" "}
                <a
                  href={INSTALL_SKILL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--highlight)] hover:underline"
                >
                  install-ori-harness skill
                </a>
                . If a harness is missing, Ori asks to install it when you
                launch.
              </p>
            </section>

            <div
              aria-hidden="true"
              className="border-t border-dashed border-white/10"
            />

            {/* 2 · Pick a harness */}
            <section aria-label="Launch any harness">
              <SectionLabel index="02">Launch any harness</SectionLabel>
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="Choose a harness"
              >
                {HARNESSES.map((name) => {
                  const active = name === harness;
                  return (
                    <button
                      key={name}
                      onClick={() => setHarness(name)}
                      aria-pressed={active}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        active
                          ? "border-[var(--highlight)] bg-[var(--highlight)]/10 text-[var(--highlight)]"
                          : "border-white/15 text-zinc-400 hover:border-white/40 hover:text-zinc-200"
                      }`}
                    >
                      ori {name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-500">
                DeepSeek Harness is setup-only:{" "}
                <code className="text-zinc-400">ori dsh</code> writes DeepSeek
                Harness config (including the default model) rather than
                starting a CLI — run <code className="text-zinc-400">dsh</code>{" "}
                as usual afterwards.
              </p>
            </section>

            <div
              aria-hidden="true"
              className="border-t border-dashed border-white/10"
            />

            {/* 3 · Launch */}
            <section aria-label="Launch with this model">
              <SectionLabel index="03">launch</SectionLabel>
              <p className="mb-1.5 text-xs text-zinc-500">
                Template:{" "}
                <code className="text-zinc-300">
                  ori HARNESS --model {modelId}
                </code>
              </p>
              <div className="rounded-lg border border-white/10 bg-black/50 px-3 py-2">
                <PromptRow
                  command={launchCommand}
                  onCopy={() => launchCopy.copy(launchCommand)}
                  copied={launchCopy.copied}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Remaining flags pass through to the agent unchanged.
              </p>
            </section>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            For more details, see the{" "}
            <a
              href={HARNESS_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--highlight)] hover:underline"
            >
              official Ori harness guide
            </a>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

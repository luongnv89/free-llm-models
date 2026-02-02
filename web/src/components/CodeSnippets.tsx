import { useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check, Terminal, Code2 } from 'lucide-react';

interface CodeSnippetsProps {
  modelId: string;
}

type Language = 'curl' | 'nodejs' | 'python';

const prismLanguageMap: Record<Language, string> = {
  curl: 'bash',
  nodejs: 'javascript',
  python: 'python',
};

export function CodeSnippets({ modelId }: CodeSnippetsProps) {
  const [activeTab, setActiveTab] = useState<Language>('curl');
  const [copied, setCopied] = useState(false);

  const snippets: Record<Language, { code: string; steps: string[] }> = {
    curl: {
      code: `curl https://openrouter.ai/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "${modelId}",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ]
  }'`,
      steps: [
        'Get your API key from OpenRouter dashboard (https://openrouter.ai/keys)',
        'Replace YOUR_API_KEY with your actual API key',
        'Run the command in your terminal',
        'The response will contain the model\'s reply in JSON format',
      ],
    },
    nodejs: {
      code: `import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "YOUR_API_KEY",
});

async function main() {
  const completion = await openai.chat.completions.create({
    model: "${modelId}",
    messages: [
      {
        role: "user",
        content: "Hello, how are you?",
      },
    ],
  });

  console.log(completion.choices[0].message.content);
}

main();`,
      steps: [
        'Install the OpenAI SDK: npm install openai',
        'Get your API key from OpenRouter dashboard (https://openrouter.ai/keys)',
        'Replace YOUR_API_KEY with your actual API key',
        'Save the code to a file (e.g., index.js) and run: node index.js',
      ],
    },
    python: {
      code: `from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="YOUR_API_KEY",
)

completion = client.chat.completions.create(
    model="${modelId}",
    messages=[
        {
            "role": "user",
            "content": "Hello, how are you?",
        },
    ],
)

print(completion.choices[0].message.content)`,
      steps: [
        'Install the OpenAI SDK: pip install openai',
        'Get your API key from OpenRouter dashboard (https://openrouter.ai/keys)',
        'Replace YOUR_API_KEY with your actual API key',
        'Save the code to a file (e.g., main.py) and run: python main.py',
      ],
    },
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(snippets[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: { key: Language; label: string; icon: React.ReactNode }[] = [
    { key: 'curl', label: 'cURL', icon: <Terminal className="h-4 w-4" /> },
    { key: 'nodejs', label: 'Node.js', icon: <Code2 className="h-4 w-4" /> },
    { key: 'python', label: 'Python', icon: <Code2 className="h-4 w-4" /> },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Start</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors flex-1 justify-center ${
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Steps */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Steps:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            {snippets[activeTab].steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        {/* Code Block with Syntax Highlighting */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 z-10 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white"
            onClick={copyCode}
          >
            {copied ? (
              <Check className="h-4 w-4 text-[var(--highlight)]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Highlight
            theme={themes.nightOwl}
            code={snippets[activeTab].code}
            language={prismLanguageMap[activeTab]}
          >
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className={`${className} p-4 rounded-lg overflow-x-auto text-sm`}
                style={{ ...style, margin: 0 }}
              >
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })}>
                    <span className="inline-block w-8 text-gray-500 select-none text-right mr-4">
                      {i + 1}
                    </span>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
      </CardContent>
    </Card>
  );
}

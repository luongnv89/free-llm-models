import { Highlight, themes } from 'prism-react-renderer';
import { Copy, Check } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

interface CodeBlockProps {
  code: string;
  language: string;
  title?: string;
}

export function CodeBlock({ code, language, title }: CodeBlockProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="relative my-4 rounded-lg overflow-hidden border border-border">
      {title && (
        <div className="px-4 py-2 bg-muted border-b border-border text-xs font-medium text-muted-foreground">
          {title}
        </div>
      )}
      <button
        onClick={() => copy(code)}
        className="absolute top-2 right-2 p-2 rounded bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors z-10"
        style={{ top: title ? '2.5rem' : '0.5rem' }}
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="h-4 w-4 text-[var(--highlight)]" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
      <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} p-4 overflow-x-auto text-sm`}
            style={{ ...style, margin: 0, borderRadius: 0 }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

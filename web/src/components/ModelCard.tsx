import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, Sparkles, ArrowRight } from 'lucide-react';
import type { Model } from '@/types/model';
import { getProvider } from '@/hooks/useModels';

interface ModelCardProps {
  model: Model;
  isNew: boolean;
}

export function ModelCard({ model, isNew }: ModelCardProps) {
  const [copied, setCopied] = useState(false);
  const provider = getProvider(model);

  const copyModelId = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(model.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatContextLength = (length: number) => {
    if (length >= 1000000) {
      return `${(length / 1000000).toFixed(1)}M`;
    }
    if (length >= 1000) {
      return `${(length / 1000).toFixed(0)}K`;
    }
    return length.toString();
  };

  const hasReasoning = model.supported_parameters.includes('reasoning') ||
    model.supported_parameters.includes('include_reasoning');
  const hasTools = model.supported_parameters.includes('tools');
  const hasVision = model.architecture.input_modalities.includes('image');
  const hasVideo = model.architecture.input_modalities.includes('video');

  return (
    <Link to={`/model/${encodeURIComponent(model.id)}`}>
      <Card className={`h-full transition-all duration-200 hover:shadow-lg hover:border-gray-300 cursor-pointer group ${isNew ? 'border-l-2 border-l-[var(--highlight)]' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  {provider}
                </span>
                {isNew && (
                  <Badge variant="outline" className="text-[var(--highlight)] border-[var(--highlight)] text-xs px-1.5 py-0">
                    <Sparkles className="w-3 h-3 mr-1" />
                    New
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-[var(--highlight)] transition-colors">
                {model.name}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={copyModelId}
              title="Copy model ID"
            >
              {copied ? (
                <Check className="h-4 w-4 text-[var(--highlight)]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2.5rem]">
            {model.description || 'No description available'}
          </p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge variant="secondary" className="text-xs">
              {formatContextLength(model.context_length)} ctx
            </Badge>
            {hasVision && (
              <Badge variant="secondary" className="text-xs">Vision</Badge>
            )}
            {hasVideo && (
              <Badge variant="secondary" className="text-xs">Video</Badge>
            )}
            {hasReasoning && (
              <Badge variant="secondary" className="text-xs">Reasoning</Badge>
            )}
            {hasTools && (
              <Badge variant="secondary" className="text-xs">Tools</Badge>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded truncate max-w-[70%]">
              {model.id}
            </code>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[var(--highlight)] transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

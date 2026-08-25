import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeSnippets } from '@/components/CodeSnippets';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { useModels, getProvider, isNewModel } from '@/hooks/useModels';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import {
  formatDate,
  formatContextLength,
  modelCapabilities,
} from '@/lib/model-utils';
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Calendar,
  Layers,
  Cpu,
  Settings,
  TriangleAlert,
} from 'lucide-react';

export function ModelDetailPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const { data, loading, error } = useModels();
  const { copied, copy } = useCopyToClipboard();

  const decodedModelId = modelId ? decodeURIComponent(modelId) : '';
  const model = data?.models.find((m) => m.id === decodedModelId);
  const isNew = model ? isNewModel(model) : false;

  const copyModelId = () => copy(decodedModelId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <TriangleAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Model not found</h2>
          <p className="text-muted-foreground mb-4">
            {error || 'The requested model could not be found.'}
          </p>
          <Link to="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Models
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const provider = getProvider(model);
  const { reasoning: hasReasoning, tools: hasTools, vision: hasVision, video: hasVideo } =
    modelCapabilities(model);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
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
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Model Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
                  {provider}
                </span>
                {isNew && (
                  <Badge
                    variant="outline"
                    className="text-[var(--highlight)] border-[var(--highlight)]"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    New
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold mb-2">{model.name}</h1>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-muted px-3 py-1.5 rounded">
                  {model.id}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={copyModelId}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-[var(--highlight)]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            {model.hugging_face_id && (
              <a
                href={`https://huggingface.co/${model.hugging_face_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Hugging Face
                </Button>
              </a>
            )}
          </div>

          {model.description && (
            <p className="text-muted-foreground leading-relaxed">
              {model.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Start */}
            <CodeSnippets modelId={model.id} />

            {/* Supported Parameters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Supported Parameters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {model.supported_parameters.map((param) => (
                    <Badge key={param} variant="secondary">
                      {param}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Specs */}
          <div className="space-y-6">
            {/* Key Specs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Layers className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Context Length</p>
                    <p className="font-semibold">
                      {formatContextLength(model.context_length)} tokens
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Cpu className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Modality</p>
                    <p className="font-semibold">{model.architecture.modality}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Added</p>
                    <p className="font-semibold">{formatDate(model.created)}</p>
                  </div>
                </div>

                {model.expiration_date && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700">
                      <span className="font-medium">Expires:</span>{' '}
                      {model.expiration_date}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Capabilities */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Capabilities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Vision</span>
                    <Badge variant={hasVision ? 'default' : 'secondary'}>
                      {hasVision ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Video</span>
                    <Badge variant={hasVideo ? 'default' : 'secondary'}>
                      {hasVideo ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Reasoning</span>
                    <Badge variant={hasReasoning ? 'default' : 'secondary'}>
                      {hasReasoning ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tool Use</span>
                    <Badge variant={hasTools ? 'default' : 'secondary'}>
                      {hasTools ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Moderated</span>
                    <Badge
                      variant={
                        model.top_provider.is_moderated ? 'default' : 'secondary'
                      }
                    >
                      {model.top_provider.is_moderated ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Input/Output Modalities */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Input / Output</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Input</p>
                  <div className="flex flex-wrap gap-1">
                    {model.architecture.input_modalities.map((m) => (
                      <Badge key={m} variant="outline">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Output</p>
                  <div className="flex flex-wrap gap-1">
                    {model.architecture.output_modalities.map((m) => (
                      <Badge key={m} variant="outline">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

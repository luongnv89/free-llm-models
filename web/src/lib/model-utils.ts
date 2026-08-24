import type { Model } from '@/types/model';

export interface ModelCapabilities {
  reasoning: boolean;
  tools: boolean;
  vision: boolean;
  video: boolean;
}

export function modelCapabilities(model: Model): ModelCapabilities {
  return {
    reasoning:
      model.supported_parameters.includes('reasoning') ||
      model.supported_parameters.includes('include_reasoning'),
    tools: model.supported_parameters.includes('tools'),
    vision: model.architecture.input_modalities.includes('image'),
    video: model.architecture.input_modalities.includes('video'),
  };
}

export function formatContextLength(length: number): string {
  if (length >= 1000000) {
    return `${(length / 1000000).toFixed(1)}M`;
  }
  if (length >= 1000) {
    return `${(length / 1000).toFixed(0)}K`;
  }
  return length.toString();
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

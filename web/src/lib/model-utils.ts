import type { LucideIcon } from 'lucide-react';
import { Eye, Video, Brain, Wrench } from 'lucide-react';
import type { Model, Popularity } from '@/types/model';

export interface ModelCapabilities {
  reasoning: boolean;
  tools: boolean;
  vision: boolean;
  video: boolean;
}

export type CapabilityTagVariant = 'vision' | 'video' | 'reasoning' | 'tools';

export interface CapabilityTag {
  key: CapabilityTagVariant;
  label: string;
  icon: LucideIcon;
  variant: CapabilityTagVariant;
}

export const CAPABILITY_TAG_META: Record<
  CapabilityTagVariant,
  Omit<CapabilityTag, 'key'>
> = {
  vision: { label: 'Vision', icon: Eye, variant: 'vision' },
  video: { label: 'Video', icon: Video, variant: 'video' },
  reasoning: { label: 'Reasoning', icon: Brain, variant: 'reasoning' },
  tools: { label: 'Tools', icon: Wrench, variant: 'tools' },
};

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

export function capabilityTags(model: Model): CapabilityTag[] {
  const caps = modelCapabilities(model);
  const order: CapabilityTagVariant[] = ['vision', 'video', 'reasoning', 'tools'];
  return order
    .filter((key) => caps[key])
    .map((key) => ({ key, ...CAPABILITY_TAG_META[key] }));
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

export function formatIsoDate(isoString: string): string {
  const date = new Date(isoString);
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

export function calendarDay(isoOrUnix: string | number): string {
  const date =
    typeof isoOrUnix === 'number' ? new Date(isoOrUnix * 1000) : new Date(isoOrUnix);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

const POPULARITY_REASON_LABELS: Record<string, string> = {
  unmatched: 'Not in OpenRouter rankings',
  unavailable: 'Rankings unavailable',
};

const POPULARITY_SOURCE_LABELS: Record<string, string> = {
  'rankings-daily': 'OpenRouter daily rankings',
  'top-weekly': 'OpenRouter weekly rankings',
};

export function popularityReasonLabel(reason?: string): string {
  if (!reason) return 'Rankings unavailable';
  return POPULARITY_REASON_LABELS[reason] ?? 'Rankings unavailable';
}

export function popularitySourceLabel(source: string): string {
  return POPULARITY_SOURCE_LABELS[source] ?? source;
}

export function popularitySummary(popularity: Popularity): string {
  if (popularity.rank != null) {
    const tokens =
      popularity.tokens != null
        ? ` · ${popularity.tokens.toLocaleString()} tokens`
        : '';
    return `Rank #${popularity.rank}${tokens}`;
  }
  return popularityReasonLabel(popularity.reason);
}

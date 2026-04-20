import type { CSSProperties } from 'react';

const GRADIENTS: Array<[string, string]> = [
  ['#6366f1', '#3b82f6'], // indigo → blue
  ['#8b5cf6', '#d946ef'], // violet → fuchsia
  ['#06b6d4', '#3b82f6'], // cyan → blue
  ['#10b981', '#14b8a6'], // emerald → teal
  ['#f59e0b', '#ef4444'], // amber → red
  ['#ec4899', '#f43f5e'], // pink → rose
  ['#84cc16', '#10b981'], // lime → emerald
  ['#475569', '#64748b'], // slate
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getInitials(name?: string | null): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? '';
  const last = parts[parts.length - 1][0] ?? '';
  return (first + last).toUpperCase();
}

export function getHashGradient(seed?: string | null): [string, string] {
  if (!seed) return GRADIENTS[0];
  const index = hashString(seed) % GRADIENTS.length;
  return GRADIENTS[index];
}

export function getAvatarGradientStyle(seed?: string | null): CSSProperties {
  const [from, to] = getHashGradient(seed);
  return { backgroundImage: `linear-gradient(135deg, ${from}, ${to})` };
}

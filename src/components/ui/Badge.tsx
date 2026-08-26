// src/components/ui/Badge.tsx
import { type ReactNode } from 'react';

type Variant = 'success' | 'warning' | 'danger' | 'neutral';

export function Badge({ children, variant = 'neutral', className = '' }: { children: ReactNode; variant?: Variant; className?: string }) {
  return <span className={`badge badge-${variant} ${className}`}>{children}</span>;
}

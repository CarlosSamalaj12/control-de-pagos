// src/components/ui/Card.tsx
import { type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export function Card({ children, className = '', padded = true, ...rest }: CardProps) {
  return (
    <div className={`card ${padded ? '' : '!p-0'} ${className}`} {...rest}>
      {children}
    </div>
  );
}

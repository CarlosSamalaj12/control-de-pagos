// src/components/ui/Button.tsx
import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white font-semibold px-4 py-3 active:scale-95 transition',
};

const sizeClass: Record<Size, string> = {
  sm: 'text-sm px-3 py-2',
  md: 'text-base',
  lg: 'text-base px-5 py-3.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, loading, className = '', children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${variantClass[variant]} ${sizeClass[size]} ${fullWidth ? 'w-full' : ''} ${disabled || loading ? 'opacity-50' : ''} ${className}`}
      {...rest}
    >
      {loading ? '...' : children}
    </button>
  );
});

// src/components/ui/Progress.tsx
interface ProgressProps {
  value: number; // 0-200 (permite over)
  max?: number;
  className?: string;
  showLabel?: boolean;
}

export function Progress({ value, max = 100, className = '', showLabel }: ProgressProps) {
  const pct = Math.max(0, Math.min(max, value));
  const isOver = value > max;
  const color = isOver
    ? 'bg-red-500'
    : value >= 80
    ? 'bg-amber-500'
    : 'bg-brand-accent';
  return (
    <div className={className}>
      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-xs text-slate-500">{Math.round(value)}%</div>
      )}
    </div>
  );
}

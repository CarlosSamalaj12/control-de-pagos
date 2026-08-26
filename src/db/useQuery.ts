// src/db/useQuery.ts
import { useEffect, useState } from 'react';
import { getDb, getDbVersion, isReady, onReady, useDbVersion } from './reactive';

export interface QueryState<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

export function useQuery<T = Record<string, any>>(
  sql: string,
  params: any[] = []
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: [],
    loading: true,
    error: null,
  });
  useDbVersion();

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      try {
        const db = getDb();
        const result = params.length === 0
          ? db.exec({ sql, rowMode: 'object', returnValue: 'resultRows' })
          : db.exec({ sql, bind: params, rowMode: 'object', returnValue: 'resultRows' });
        if (!cancelled) {
          setState({ data: result as T[], loading: false, error: null });
        }
      } catch (e) {
        if (!cancelled) {
          setState({ data: [], loading: false, error: e as Error });
        }
      }
    };

    if (isReady()) {
      run();
    } else {
      onReady(run);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql, JSON.stringify(params), getDbVersion()]);

  return state;
}

/** Helper para queries que devuelven un solo valor escalar (count, sum, max). */
export function useScalar<T = any>(sql: string, params: any[] = [], fallback: T): T {
  const { data, loading, error } = useQuery<{ v: T }>(sql, params);
  if (loading || error || data.length === 0) return fallback;
  return (data[0] as any).v ?? fallback;
}

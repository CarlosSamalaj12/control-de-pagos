// src/hooks/useSelectionMode.ts
// Hook simple para manejar el modo selección en listas (CicloDetalle,
// Deudas). Mantiene el estado local; no se guarda en un store global.
import { useCallback, useMemo, useState } from 'react';

export interface SelectionMode {
  /** Set de ids seleccionados. */
  selected: Set<string>;
  /** Cantidad de items seleccionados. */
  count: number;
  /** ¿Está el modo selección activo? (true cuando hay al menos 1 item). */
  active: boolean;
  /** ¿Este id está seleccionado? */
  isSelected: (id: string) => boolean;
  /** Agrega o quita un id del set. Si se agrega el primero, activa el modo. */
  toggle: (id: string) => void;
  /** Activa el modo sin seleccionar nada (e.g. tap en un toggle del header). */
  enter: () => void;
  /** Sale del modo y limpia el set. */
  clear: () => void;
  /** Reemplaza el set completo (útil para pre-seleccionar N items). */
  setMany: (ids: string[]) => void;
}

export function useSelectionMode(): SelectionMode {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(false);

  const isSelected = useCallback(
    (id: string) => selected.has(id),
    [selected]
  );

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setActive(true);
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    setActive(false);
  }, []);

  const enter = useCallback(() => {
    setActive(true);
  }, []);

  const setMany = useCallback((ids: string[]) => {
    setSelected(new Set(ids));
    setActive(true);
  }, []);

  return useMemo(
    () => ({
      selected,
      count: selected.size,
      active,
      isSelected,
      toggle,
      enter,
      clear,
      setMany,
    }),
    [selected, active, isSelected, toggle, clear, enter, setMany]
  );
}

import { useEffect, useRef, useCallback } from 'react';

export function useFormDraft(options: {
  key: string;
  fields: Record<string, { value: unknown; setter: (v: unknown) => void }>;
  excludeFields?: string[];
  debounceMs?: number;
  enabled?: boolean;
}) {
  const { key, fields, excludeFields = [], debounceMs = 500, enabled = true } = options;
  const timeoutRef = useRef<number | null>(null);
  const isRestoringRef = useRef(false);

  const restore = useCallback(() => {
    if (!enabled) return;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const draft = JSON.parse(saved);
        isRestoringRef.current = true;
        Object.entries(draft).forEach(([field, value]) => {
          if (!excludeFields.includes(field) && fields[field]) {
            fields[field].setter(value);
          }
        });
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 0);
      }
    } catch (e) {
      console.warn('Failed to restore form draft:', e);
    }
  }, [key, enabled, excludeFields, fields]);

  const save = useCallback(() => {
    if (!enabled || isRestoringRef.current) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      try {
        const values: Record<string, unknown> = {};
        Object.entries(fields).forEach(([field, { value }]) => {
          if (!excludeFields.includes(field)) {
            values[field] = value;
          }
        });
        localStorage.setItem(key, JSON.stringify(values));
      } catch (e) {
        console.warn('Failed to save form draft:', e);
      }
    }, debounceMs);
  }, [key, enabled, debounceMs, excludeFields, fields]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Failed to clear form draft:', e);
    }
  }, [key]);

  const hasDraft = useCallback(() => {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }, [key]);

  return { restore, save, clear, hasDraft };
}

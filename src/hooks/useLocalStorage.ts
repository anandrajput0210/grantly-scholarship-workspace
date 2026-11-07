import { useEffect, useState } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  validate?: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) return initialValue;
      const parsed: unknown = JSON.parse(stored);
      if (validate && !validate(parsed)) {
        console.warn(`Stored data for ${key} has an unsupported shape. Starting with demo defaults.`);
        return initialValue;
      }
      return parsed as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Unable to persist ${key} in localStorage`, error);
    }
  }, [key, value]);

  return [value, setValue] as const;
}

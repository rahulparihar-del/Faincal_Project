import { useState, useEffect, useCallback, useRef } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isClient, setIsClient] = useState(false);
  const isInitialized = useRef(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        setStoredValue(parsed);
        isInitialized.current = true;
      } else {
        isInitialized.current = true;
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      isInitialized.current = true;
    }
  }, [key]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prevValue) => {
        const valueToStore = value instanceof Function ? value(prevValue) : value;
        
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
          } catch (storageError) {
            // Handle quota exceeded or other storage errors
            if (storageError instanceof DOMException && storageError.name === 'QuotaExceededError') {
              console.error(`localStorage quota exceeded for key "${key}"`);
            } else {
              console.error(`Error writing to localStorage key "${key}":`, storageError);
            }
          }
        }
        
        return valueToStore;
      });
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue, isClient] as const;
}

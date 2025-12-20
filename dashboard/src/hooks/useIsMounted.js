import { useRef, useEffect } from 'react';

/**
 * Hook to check if component is still mounted
 * Prevents state updates on unmounted components
 * @returns {React.RefObject} Ref with current mounted state
 */
export function useIsMounted() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef;
}

'use client';

import { useRef, useEffect, useState, ReactNode } from 'react';
import { useUIStore } from './ui-store';

interface HydratedStateProps {
  children: ReactNode;
}

export function HydratedState({ children }: HydratedStateProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const store = useUIStore();

  useEffect(() => {
    // Check if the store has been hydrated
    const unsubFinishHydration = useUIStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    // Check if already hydrated
    if (useUIStore.persist.hasHydrated()) {
      setIsHydrated(true);
    }

    // Cleanup
    return () => {
      unsubFinishHydration();
    };
  }, []);

  return <>{children}</>;
}

// Hook to safely use persisted state
export function useHydratedStore<T>(
  selector: (state: any) => T,
  fallback: T
): T {
  const [hasHydrated, setHasHydrated] = useState(false);
  const state = useUIStore(selector);

  useEffect(() => {
    setHasHydrated(useUIStore.persist.hasHydrated());

    const unsubscribe = useUIStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    return unsubscribe;
  }, []);

  return hasHydrated ? state : fallback;
}

// Wrapper component that prevents hydration mismatch
export function StoreHydration({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Return placeholder during SSR
  if (!isClient) {
    return (
      <div suppressHydrationWarning>
        {/* Render with default values during SSR */}
        {children}
      </div>
    );
  }

  // Return actual store-connected components after hydration
  return <HydratedState>{children}</HydratedState>;
}
import type React from 'react';
import { useContext, useEffect, useMemo, useRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { WalkthroughContext } from './context';
import { ScrollContainerContext } from './WalkthroughScrollView';

/**
 * Registers a view as a walkthrough target. Attach the returned ref to any
 * host `View` (one that isn't optimised away — `collapsable={false}`):
 *
 *   const ref = useWalkthroughTarget('profile-avatar');
 *   <View ref={ref} collapsable={false}>…</View>
 */
export function useWalkthroughTarget(
  id: string,
  options: { scrollRef?: React.RefObject<unknown> | null } = {},
) {
  const ctx = useContext(WalkthroughContext);
  const containers = useContext(ScrollContainerContext);
  const scrollRef = options.scrollRef;
  // An explicit scrollRef is the innermost container; enclosing ones still scroll after it.
  const scrollChain = useMemo(
    () => (scrollRef ? [scrollRef, ...containers.filter((c) => c !== scrollRef)] : containers),
    [scrollRef, containers],
  );
  const ref = useRef<View>(null);
  const register = ctx?.registerTarget;
  useEffect(() => register?.(id, ref, scrollChain), [register, id, scrollChain]);
  return ref;
}

export interface WalkthroughTargetProps extends ViewProps {
  /** Referenced from a step's `target`. */
  id: string;
  /**
   * The ScrollView / FlatList this target lives in, if it isn't inside a
   * `WalkthroughScrollView` / `WalkthroughScrollContainer` — used to scroll it
   * into view before it's spotlighted.
   */
  scrollRef?: React.RefObject<unknown> | null;
}

/**
 * Wraps its children in a measurable view registered under `id`:
 *
 *   <WalkthroughTarget id="search-bar">
 *     <SearchBar />
 *   </WalkthroughTarget>
 */
export function WalkthroughTarget({
  id,
  scrollRef,
  onLayout,
  children,
  ...viewProps
}: WalkthroughTargetProps) {
  const ref = useWalkthroughTarget(id, { scrollRef });
  const ctx = useContext(WalkthroughContext);
  const isCurrent = ctx?.isActive && ctx.currentStep?.target === id;
  const refresh = ctx?.refresh;
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={(e) => {
        onLayout?.(e);
        // Content above it grew / shrank while it's spotlighted → follow it.
        if (isCurrent) refresh?.();
      }}
      {...viewProps}
    >
      {children}
    </View>
  );
}

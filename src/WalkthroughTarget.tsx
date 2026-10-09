import { useContext, useEffect, useRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { WalkthroughContext } from './context';

/**
 * Registers a view as a walkthrough target. Attach the returned ref to any
 * host `View` (one that isn't optimised away — `collapsable={false}`):
 *
 *   const ref = useWalkthroughTarget('profile-avatar');
 *   <View ref={ref} collapsable={false}>…</View>
 */
export function useWalkthroughTarget(id: string) {
  const ctx = useContext(WalkthroughContext);
  const ref = useRef<View>(null);
  const register = ctx?.registerTarget;
  useEffect(() => register?.(id, ref), [register, id]);
  return ref;
}

export interface WalkthroughTargetProps extends ViewProps {
  /** Referenced from a step's `target`. */
  id: string;
}

/**
 * Wraps its children in a measurable view registered under `id`:
 *
 *   <WalkthroughTarget id="search-bar">
 *     <SearchBar />
 *   </WalkthroughTarget>
 */
export function WalkthroughTarget({ id, children, ...viewProps }: WalkthroughTargetProps) {
  const ref = useWalkthroughTarget(id);
  return (
    <View ref={ref} collapsable={false} {...viewProps}>
      {children}
    </View>
  );
}

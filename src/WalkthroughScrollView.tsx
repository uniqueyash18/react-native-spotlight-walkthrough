import React, { createContext, forwardRef, useContext, useImperativeHandle, useMemo, useRef } from 'react';
import { ScrollView, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from 'react-native';
import { WalkthroughContext } from './context';
import type { ScrollableRef } from './scroll';

/** Enclosing scroll containers, innermost first — a horizontal list inside a vertical page scrolls both. */
export const ScrollContainerContext = createContext<readonly ScrollableRef[]>([]);

export interface WalkthroughScrollContainerProps {
  /** Ref to the ScrollView / FlatList / SectionList the targets live in. */
  scrollRef: ScrollableRef;
  children: React.ReactNode;
}

/**
 * Tells every `WalkthroughTarget` inside it which scrollable to scroll so the
 * target is on screen before it's spotlighted. Use it around a FlatList (or
 * any custom scroll view); for a plain ScrollView, `WalkthroughScrollView`
 * does this for you.
 *
 *   const listRef = useRef<FlatList>(null);
 *   <WalkthroughScrollContainer scrollRef={listRef}>
 *     <FlatList ref={listRef} … />
 *   </WalkthroughScrollContainer>
 *
 * FlatList only renders items near the viewport — a target in an item that
 * isn't rendered yet can't be measured. Bring it into range first with the
 * step's `onBeforeEnter` (e.g. `listRef.current?.scrollToIndex(...)`).
 */
export function WalkthroughScrollContainer({ scrollRef, children }: WalkthroughScrollContainerProps) {
  const parents = useContext(ScrollContainerContext);
  const chain = useMemo(() => [scrollRef, ...parents], [scrollRef, parents]);
  return <ScrollContainerContext.Provider value={chain}>{children}</ScrollContainerContext.Provider>;
}

/**
 * Drop-in `ScrollView` for screens with walkthrough targets: targets inside
 * it are scrolled into view before they're spotlighted, and the spotlight
 * follows if the user scrolls during a step.
 */
export const WalkthroughScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function WalkthroughScrollView(
    { onScrollEndDrag, onMomentumScrollEnd, onContentSizeChange, ...props },
    forwardedRef,
  ) {
    const ref = useRef<ScrollView>(null);
    useImperativeHandle(forwardedRef, () => ref.current as ScrollView, []);
    const walkthrough = useContext(WalkthroughContext);

    const settle =
      (handler?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void) =>
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        handler?.(e);
        // The spotlight is measured in window space — re-measure once the content stops moving.
        if (walkthrough?.isActive) walkthrough.refresh();
      };

    return (
      <WalkthroughScrollContainer scrollRef={ref}>
        <ScrollView
          ref={ref}
          onScrollEndDrag={settle(onScrollEndDrag)}
          onMomentumScrollEnd={settle(onMomentumScrollEnd)}
          onContentSizeChange={(w, h) => {
            onContentSizeChange?.(w, h);
            // Content changed size (async data, images, an expanding section)
            // → whatever is spotlighted may have moved.
            if (walkthrough?.isActive) walkthrough.refresh();
          }}
          {...props}
        />
      </WalkthroughScrollContainer>
    );
  },
);

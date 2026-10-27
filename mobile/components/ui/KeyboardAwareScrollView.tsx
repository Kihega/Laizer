/**
 * Laizer — KeyboardAwareScrollView
 * __LAIZER_PATCH_V12__
 *
 * A drop-in ScrollView that keeps the focused input visible above the
 * on-screen keyboard:
 *   • adds bottom padding equal to the keyboard height while it is open,
 *     so the last fields can always be scrolled above it;
 *   • scrolls the focused input into view when the keyboard opens AND when
 *     focus moves to another field while the keyboard is already open.
 *
 * Pure JS (no native module), so it works in Expo Go, dev builds and EAS
 * builds, on Android (incl. edge-to-edge) and iOS. Inputs that are not inside
 * this ScrollView are ignored, so several of these can be mounted at once.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Dimensions, Keyboard, Platform, ScrollView, StyleSheet, TextInput,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollViewProps } from 'react-native';

interface Props extends ScrollViewProps {
  children?: ReactNode;
  /** Breathing room (px) kept between the focused input and the keyboard. */
  extraOffset?: number;
}

export const KeyboardAwareScrollView = forwardRef<any, Props>(function KeyboardAwareScrollView(
  {
    children,
    contentContainerStyle,
    onScroll,
    extraOffset = 28,
    keyboardShouldPersistTaps = 'handled',
    ...rest
  },
  outerRef,
) {
  const scrollRef = useRef<any>(null);
  const scrollY   = useRef(0);
  const kbTop     = useRef<number | null>(null);   // screen Y of the keyboard's top edge; null = hidden
  const lastFocus = useRef<unknown>(null);
  const [kbHeight, setKbHeight] = useState(0);

  useImperativeHandle(outerRef, () => scrollRef.current);

  /** Scroll so the currently focused input sits fully above the keyboard. */
  const reveal = useCallback(() => {
    const input: any = (TextInput as any).State?.currentlyFocusedInput?.();
    const sv: any    = scrollRef.current;
    const inner: any = sv?.getInnerViewRef?.() ?? sv?.getInnerViewNode?.();
    if (!input || !sv || !inner || kbTop.current == null) return;
    try {
      input.measureLayout(
        inner,
        (_x: number, y: number, _w: number, h: number) => {
          sv.measureInWindow((_sx: number, svY: number) => {
            if (kbTop.current == null) return;
            const visibleBottom = kbTop.current - svY;          // keyboard top, in scroll-viewport coords
            const bottomNeeded  = y + h + extraOffset;
            if (bottomNeeded > scrollY.current + visibleBottom) {
              scrollRef.current?.scrollTo({ y: bottomNeeded - visibleBottom, animated: true });
            } else if (y - extraOffset < scrollY.current) {
              scrollRef.current?.scrollTo({ y: Math.max(0, y - extraOffset), animated: true });
            }
          });
        },
        () => { /* the focused input is not inside this ScrollView */ },
      );
    } catch { /* measuring is best-effort — never crash a form over it */ }
  }, [extraOffset]);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', e => {
      const { screenY, height } = e.endCoordinates;
      kbTop.current = Number.isFinite(screenY) && screenY > 0
        ? screenY
        : Dimensions.get('screen').height - height;
      lastFocus.current = null;
      setKbHeight(height);
      setTimeout(reveal, 120);               // let the extra padding lay out first
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      kbTop.current = null;
      lastFocus.current = null;
      setKbHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, [reveal]);

  // While the keyboard is open, notice when focus jumps to a different field.
  useEffect(() => {
    if (!kbHeight) return;
    const id = setInterval(() => {
      const cur = (TextInput as any).State?.currentlyFocusedInput?.() ?? null;
      if (cur && cur !== lastFocus.current) { lastFocus.current = cur; reveal(); }
    }, 250);
    return () => clearInterval(id);
  }, [kbHeight, reveal]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  };

  const flat = (StyleSheet.flatten(contentContainerStyle) ?? {}) as { paddingBottom?: number | string };
  const basePad = typeof flat.paddingBottom === 'number' ? flat.paddingBottom : 0;

  return (
    <ScrollView
      ref={scrollRef}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...rest}
      onScroll={handleScroll}
      contentContainerStyle={[flat, { paddingBottom: basePad + kbHeight }]}
    >
      {children}
    </ScrollView>
  );
});

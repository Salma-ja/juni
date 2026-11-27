import { useEffect, useRef, useState } from 'react';
import {
  Image, type ImageSourcePropType, type NativeScrollEvent, type NativeSyntheticEvent,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { ScalePressable } from '@/components/ui';
import { color } from '@/theme';

export type Banner = { id: string; label: string; image: ImageSourcePropType; onPress: () => void };

const GAP = 12;
const AUTO_ADVANCE_MS = 4500;

/** Swipeable promo banners (2:1 artwork) that snap one at a time and auto-advance until touched. */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const cardWidth = Math.max(0, width - 28);
  const step = cardWidth + GAP;

  useEffect(() => {
    if (paused || !step || banners.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % banners.length;
        scroller.current?.scrollTo({ x: next * step, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [paused, step, banners.length]);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!step) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / step);
    if (next !== index) setIndex(Math.max(0, Math.min(banners.length - 1, next)));
  }

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.wrap}>
      {width > 0 && (
        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          onScroll={onScroll}
          scrollEventThrottle={32}
          onTouchStart={() => setPaused(true)}
          contentContainerStyle={{ gap: GAP }}
        >
          {banners.map((banner) => (
            <ScalePressable
              key={banner.id}
              accessibilityLabel={banner.label}
              onPress={banner.onPress}
              scaleTo={0.97}
              style={[styles.card, { width: cardWidth, height: cardWidth / 2 }]}
            >
              <Image source={banner.image} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
            </ScalePressable>
          ))}
        </ScrollView>
      )}
      <View style={styles.dots}>
        {banners.map((banner, i) => (
          <View key={banner.id} style={[styles.dot, i === index && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 },
  card: { borderRadius: 18, overflow: 'hidden', backgroundColor: color.soft },
  image: { width: '100%', height: '100%' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.line },
  dotOn: { width: 18, backgroundColor: color.brand },
});

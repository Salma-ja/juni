import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Route } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, useWindowDimensions, View,
  type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { color, font, radius, shadow, spacing, type Weight } from '@/theme';
import { formatOffset, useClockOffset } from '@/data/clock';

type CopyProps = TextProps & { size?: number; weight?: Weight; tint?: string };
export function Copy({ size = 12, weight = 400, tint = color.ink, style, ...props }: CopyProps) {
  return <Text {...props} style={[{ fontFamily: font[weight], fontSize: size, color: tint, includeFontPadding: false }, style]} />;
}

export function Eyebrow({ children, tint = color.brand, size = 10 }: {
  children: ReactNode; tint?: string; size?: number;
}) {
  return <Copy size={size} tint={tint} weight={800} style={{ letterSpacing: size * 0.12 }}>{children}</Copy>;
}

export function Row({ children, gap = 9, style }: {
  children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

export function Pile({ children, gap = 10, style }: {
  children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Page({ children, style, mode = 'page' }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; mode?: 'page' | 'auth' | 'edge';
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const { height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const clock = useClockOffset();
  useEffect(() => {
    const animation = Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [fade]);

  return (
    <SafeAreaView edges={mode === 'edge' ? ['left', 'right'] : ['top', 'left', 'right']} style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <Animated.View style={[
          styles.page,
          { paddingBottom: 38 + bottom },
          mode === 'auth' && styles.auth,
          mode === 'edge' && { padding: 0, minHeight: height },
          style,
          { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] },
        ]}>
          {children}
        </Animated.View>
      </ScrollView>
      {clock !== 0 && (
        <View pointerEvents="none" accessibilityLabel={`Demo clock ${formatOffset(clock)}`} style={styles.demoPill}>
          <Copy size={9} weight={800} tint={color.white}>{`DEMO ${formatOffset(clock)}`}</Copy>
        </View>
      )}
    </SafeAreaView>
  );
}

export function Logo({ compact = false, light = false, splash = false }: {
  compact?: boolean; light?: boolean; splash?: boolean;
}) {
  return (
    <Row gap={11}>
      <View style={[styles.logoMark, compact && styles.logoMarkSmall, splash && styles.logoMarkSplash]}>
        <Route size={splash ? 44 : compact ? 19 : 30} color={color.white} strokeWidth={2.5} />
      </View>
      <Copy tint={light ? color.white : color.navy} size={splash ? 42 : compact ? 17 : 31} weight={800}
        style={{ letterSpacing: compact ? 1.19 : 3.72 }}>JUNI</Copy>
    </Row>
  );
}

export function Header({ title, onBack, action, eyebrow }: {
  title: string; onBack?: () => void; action?: ReactNode; eyebrow?: string;
}) {
  return (
    <Row gap={11} style={styles.header}>
      {onBack ? <IconButton icon={ArrowLeft} label="Go back" onPress={onBack} size={21} /> : <Logo compact />}
      <View style={styles.grow}>
        {!!eyebrow && <Eyebrow tint={color.muted} size={9}>{eyebrow}</Eyebrow>}
        <Copy accessibilityRole="header" size={18} weight={800} style={{ letterSpacing: -0.45 }}>{title}</Copy>
      </View>
      <View style={styles.headerAction}>{action}</View>
    </Row>
  );
}

export function IconButton({ icon: Icon, label, onPress, size = 19, style, tint = color.navy }: {
  icon: LucideIcon; label: string; onPress?: () => void; size?: number; style?: StyleProp<ViewStyle>; tint?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.iconButton, style, pressed && onPress && styles.pressed]}>
      <Icon color={tint} size={size} />
    </Pressable>
  );
}

export function Button({ children, onPress, tone = 'primary', disabled = false, icon: Icon, style, size = 14 }: {
  children: string; onPress?: () => void; tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean; icon?: LucideIcon; style?: StyleProp<ViewStyle>; size?: number;
}) {
  const tint = disabled ? '#929D9A' : tone === 'secondary' ? color.navy : color.white;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled}
      style={({ pressed }) => [styles.button, styles[tone], disabled && styles.disabled, style, pressed && styles.pressed]}>
      {Icon && <Icon size={18} color={tint} />}
      <Copy size={size} tint={tint} weight={750} style={styles.grow}>{children}</Copy>
      {tone === 'primary' && !disabled && <ArrowRight size={18} color={tint} />}
    </Pressable>
  );
}

export function TextLink({ children, onPress, style, size = 12, tint = color.brand }: {
  children: string; onPress?: () => void; style?: StyleProp<ViewStyle>; size?: number; tint?: string;
}) {
  return (
    <Pressable style={style} accessibilityRole="button" onPress={onPress}>
      <Copy tint={tint} weight={700} size={size}>{children}</Copy>
    </Pressable>
  );
}

const badgeColors = {
  green: ['#FFF0F7', '#C90068'], violet: ['#F0ECFF', '#6851BE'],
  rose: ['#FFECEF', '#BD4862'], blue: ['#EAF6FF', '#387BA5'],
  amber: ['#FFF3D5', '#9B6814'], red: ['#FFE9E8', '#BD3D3D'], slate: ['#EDF1F2', '#5C6A70'],
} as const;

export function Badge({ children, tone = 'green', icon: Icon, iconSize = 13, style }: {
  children?: string; tone?: keyof typeof badgeColors; icon?: LucideIcon; iconSize?: number; style?: StyleProp<ViewStyle>;
}) {
  const [backgroundColor, tint] = badgeColors[tone];
  return (
    <Row gap={4} style={[styles.badge, { backgroundColor }, style]}>
      {Icon && <Icon color={tint} size={iconSize} />}
      {!!children && <Copy size={9} weight={800} tint={tint} style={styles.badgeText}>{children}</Copy>}
    </Row>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pile gap={7}>
      <Copy size={12} tint="#344952" weight={700}>{label}</Copy>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor="#A1ACAE"
        style={[styles.input, focused && styles.inputFocused, props.style]}
        onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); props.onBlur?.(event); }} />
    </Pile>
  );
}

export function InfoRow({ icon: Icon, label, value, onPress, style }: {
  icon: LucideIcon; label: string; value: string; onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const contents = (
    <>
      <View style={styles.rowIcon}><Icon color={color.brand} size={20} /></View>
      <Pile gap={3} style={styles.grow}>
        <Copy size={9} tint={color.muted}>{label}</Copy>
        <Copy weight={800} tint={color.navy}>{value}</Copy>
      </Pile>
      {onPress && <ChevronRight size={18} color={color.muted} />}
    </>
  );
  return onPress
    ? <Pressable accessibilityRole="button" onPress={onPress} style={[styles.infoRow, style]}>{contents}</Pressable>
    : <View style={[styles.infoRow, style]}>{contents}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function GradientCard({ children, colors, style }: {
  children: ReactNode; colors: readonly [string, string, ...string[]]; style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient colors={colors} start={{ x: 0.08, y: 0 }} end={{ x: 0.92, y: 1 }}
      style={[styles.gradientCard, style]}>{children}</LinearGradient>
  );
}

export function Tile({ icon: Icon, size = 38, iconSize = 20, tint = color.brand, background = color.pink, style }: {
  icon: LucideIcon; size?: number; iconSize?: number; tint?: string; background?: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size / 3), backgroundColor: background }, style]}>
      <Icon size={iconSize} color={tint} />
    </View>
  );
}

export function Notice({ children, icon: Icon, style, tint = '#735C23' }: {
  children: string; icon: LucideIcon; style?: StyleProp<ViewStyle>; tint?: string;
}) {
  return (
    <Row gap={10} style={[styles.notice, style]}>
      <Icon color={tint} size={18} />
      <Copy tint={tint} size={11} style={styles.noticeCopy}>{children}</Copy>
    </Row>
  );
}

export function SectionHeading({ title, note, onPress }: { title: string; note?: string; onPress?: () => void }) {
  return (
    <Row style={styles.sectionHeading}>
      <Copy accessibilityRole="header" weight={800} size={15}>{title}</Copy>
      {!!note && (onPress
        ? <TextLink onPress={onPress} size={10}>{note}</TextLink>
        : <Copy size={10} weight={700} tint={color.brand}>{note}</Copy>)}
    </Row>
  );
}

export function Avatar({ name, index = 0, size = 36 }: { name: string; index?: number; size?: number }) {
  const palette = [['#E8CFC5', '#795B50'], ['#D5DCEC', '#52647F'], ['#E8D9BC', '#756341'], ['#D8E8E0', '#547060']];
  const [backgroundColor, tint] = palette[index % palette.length];
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size / 2, backgroundColor }]}>
      <Copy size={size < 30 ? 8 : 11} weight={800} tint={tint}>{name}</Copy>
    </View>
  );
}

export function RouteCard({ start, end, style, onEndPress }: {
  start: { label: string; title: string; detail: string };
  end: { label: string; title: string; detail: string };
  style?: StyleProp<ViewStyle>;
  onEndPress?: () => void;
}) {
  return (
    <Row gap={11} style={[styles.routeCard, style]}>
      <View style={styles.routeLine}>
        <View style={styles.routeStart} />
        <View style={styles.routeDash}>
          <Svg width={1} height="100%"><Line x1="0.5" x2="0.5" y1="0" y2="100%" stroke="#9FB1AD" strokeDasharray="2 2" /></Svg>
        </View>
        <View style={styles.routeEnd} />
      </View>
      <Pile gap={17} style={styles.grow}>
        <RouteStop stop={start} />
        {onEndPress ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Change destination, ${end.title}`} onPress={onEndPress}>
            <Row><View style={styles.grow}><RouteStop stop={end} /></View><ChevronRight size={18} color={color.muted} /></Row>
          </Pressable>
        ) : <RouteStop stop={end} />}
      </Pile>
    </Row>
  );
}

function RouteStop({ stop }: { stop: { label: string; title: string; detail: string } }) {
  return (
    <Pile gap={4}>
      <Eyebrow tint={color.muted} size={8}>{stop.label}</Eyebrow>
      <Copy tint={color.navy} size={13} weight={800}>{stop.title}</Copy>
      <Copy tint={color.muted} size={10}>{stop.detail}</Copy>
    </Pile>
  );
}

export function ProgressBar({ value, height = 4, track = '#E2E9E7' }: { value: number; height?: number; track?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: value }}
      style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${value}%`, height, borderRadius: height, backgroundColor: color.brand }} />
    </View>
  );
}

const captainPhoto = require('../../assets/images/captain-omar.png');

export function CaptainPhoto({ style }: { style?: StyleProp<import('react-native').ImageStyle> }) {
  return <Image accessible accessibilityLabel="Captain photo" source={captainPhoto} style={[styles.captainPhoto, style]} />;
}

export function CaptainMini({ label, title, accessory }: { label: string; title: string; accessory?: ReactNode }) {
  return (
    <Row style={styles.captainMini}>
      <CaptainPhoto />
      <Pile gap={4} style={styles.grow}>
        <Eyebrow tint={color.muted} size={7}>{label}</Eyebrow>
        <Copy size={11} weight={800}>{title}</Copy>
      </Pile>
      {accessory}
    </Row>
  );
}

export function SheetHandle() {
  return <View style={styles.sheetHandle} />;
}

export function BottomSheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const { height } = useWindowDimensions();
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: 300, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <Modal transparent animationType="none" onRequestClose={onClose} presentationStyle="overFullScreen" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdropTint, { opacity: progress }]} />
        <Animated.View style={[styles.sheetFrame, {
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
        }]}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetContent}>
              {children}
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function SheetHeading({ icon, title, detail, tone = 'green' }: {
  icon: LucideIcon; title: string; detail: string; tone?: 'green' | 'amber' | 'red';
}) {
  const [background, tint] = badgeColors[tone];
  return (
    <Pile gap={7} style={{ alignItems: 'center', marginBottom: 8 }}>
      <Tile icon={icon} size={46} iconSize={25} background={background} tint={tint} style={{ marginBottom: 6 }} />
      <Copy accessibilityRole="header" size={20} weight={800} style={center}>{title}</Copy>
      <Copy size={10} tint={color.muted} style={[center, { lineHeight: 16, marginHorizontal: 15 }]}>{detail}</Copy>
    </Pile>
  );
}

export function CheckDot({ active, index }: { active: boolean; index: number }) {
  return (
    <View style={[styles.checkDot, { backgroundColor: active ? color.brand : '#EDF1F0' }]}>
      {active ? <Check size={14} color={color.white} /> : <Copy size={8} weight={800} tint="#9AA6A3">{index}</Copy>}
    </View>
  );
}

export const center: TextStyle = { textAlign: 'center' };
export const fill: ViewStyle = { flex: 1 };
export const spread: ViewStyle = { justifyContent: 'space-between' };

const styles = StyleSheet.create({
  demoPill: { position: 'absolute', top: 10, right: 14, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: '#7157D2', zIndex: 10 },
  safe: { flex: 1, backgroundColor: color.white },
  scroll: { flexGrow: 1 },
  page: { flexGrow: 1, paddingTop: 18, paddingHorizontal: spacing.page, paddingBottom: 38, backgroundColor: color.white },
  auth: { paddingHorizontal: 24, paddingTop: 44, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  logoMark: {
    width: 58, height: 58, borderRadius: 18, backgroundColor: color.brand, alignItems: 'center',
    justifyContent: 'center', transform: [{ rotate: '-2deg' }], ...shadow(11, 25, '#EC007A38'),
  },
  logoMarkSmall: { width: 38, height: 38, borderRadius: 12, boxShadow: 'none' },
  logoMarkSplash: { width: 82, height: 82, borderRadius: 24 },
  header: { minHeight: 45, marginBottom: 25 },
  headerAction: { minWidth: 40, alignItems: 'flex-end' },
  iconButton: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: color.line, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82 },
  button: { minHeight: spacing.button, borderRadius: radius.button, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 9 },
  primary: { backgroundColor: color.brand, ...shadow(10, 20, '#EC007A2B') },
  secondary: { backgroundColor: color.sage, borderWidth: 1, borderColor: color.line },
  danger: { backgroundColor: color.danger, ...shadow(10, 20, '#D9444424') },
  disabled: { backgroundColor: '#DCE3E1', boxShadow: 'none' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { lineHeight: 10 },
  input: {
    minHeight: 54, borderRadius: radius.field, borderColor: color.line, borderWidth: 1, backgroundColor: '#F9FBFA',
    paddingHorizontal: 15, paddingVertical: 8, fontSize: 14, fontFamily: font[400], color: color.navy,
  },
  inputFocused: { borderColor: color.brand, backgroundColor: color.white, ...shadow(0, 3, '#EC007A17') },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, minHeight: 66 },
  rowIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: color.pink, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.card, padding: 16, borderWidth: 1, borderColor: color.line, backgroundColor: color.white },
  gradientCard: { borderRadius: 22, padding: 20 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  notice: { paddingVertical: 12, paddingHorizontal: 13, borderRadius: 12, backgroundColor: '#FFF8DF' },
  noticeCopy: { flex: 1, lineHeight: 16.5 },
  sectionHeading: { justifyContent: 'space-between', marginTop: 25, marginBottom: 11 },
  routeCard: { paddingVertical: 19, paddingHorizontal: 17, borderRadius: radius.card, backgroundColor: '#F6F9F8' },
  routeLine: { alignSelf: 'stretch', alignItems: 'center', width: 20, paddingTop: 5 },
  routeStart: { borderRadius: 8, width: 9, height: 9, borderWidth: 3, borderColor: color.brand },
  routeDash: { flex: 1, width: 1 },
  routeEnd: { borderRadius: 3, width: 10, height: 10, backgroundColor: color.brand },
  captainMini: { padding: 11, backgroundColor: color.sage, borderRadius: 13 },
  captainPhoto: { width: 40, height: 40, borderRadius: 12 },
  sheetHandle: { width: 38, height: 4, borderRadius: 5, backgroundColor: '#DCE2E0', alignSelf: 'center', marginBottom: 20 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  backdropTint: { backgroundColor: '#091C1E85' },
  sheetFrame: { width: '100%', maxWidth: 440, maxHeight: '90%' },
  sheet: { backgroundColor: color.white, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  sheetContent: { gap: 9, paddingTop: 12, paddingHorizontal: 21, paddingBottom: 28 },
  checkDot: { width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

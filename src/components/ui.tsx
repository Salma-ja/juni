import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronRight, Route } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import {
  Animated, Easing, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, useWindowDimensions, View,
  type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { color, font, radius, shadow, spacing, type Weight } from '@/theme';
import { formatOffset, useClockOffset } from '@/data/clock';

const NATIVE_DRIVER = Platform.OS !== 'web';

type CopyProps = TextProps & { size?: number; weight?: Weight; tint?: string };
export function Copy({ size = 14, weight = 400, tint = color.ink, style, ...props }: CopyProps) {
  const clamped = Math.max(12, size);
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={1.4}
      {...props}
      style={[{ fontFamily: font[weight], fontSize: clamped, color: tint, includeFontPadding: false }, style]}
    />
  );
}

export function Eyebrow({ children, tint = color.brand, size = 12 }: {
  children: ReactNode; tint?: string; size?: number;
}) {
  const clamped = Math.max(12, size);
  return <Copy size={clamped} tint={tint} weight={800} style={{ letterSpacing: 0.9 }}>{children}</Copy>;
}

export function Row({ children, gap = 10, style }: {
  children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

export function Pile({ children, gap = 10, style }: {
  children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

/** Tactile spring pressable with minimum 48px touch target (Fitts' Law). */
const OUTER_LAYOUT_KEYS = [
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'minWidth', 'maxWidth',
  'height', 'minHeight', 'maxHeight', 'aspectRatio', 'alignSelf',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'marginStart', 'marginEnd', 'position', 'top', 'bottom', 'left', 'right', 'zIndex',
] as const;

export function ScalePressable({
  children, onPress, disabled = false, accessibilityLabel, accessibilityRole = 'button',
  accessibilityState, style, scaleTo = 0.97,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'radio' | 'tab';
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    if (disabled) return;
    Animated.spring(scale, { toValue: scaleTo, speed: 36, bounciness: 4, useNativeDriver: NATIVE_DRIVER }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, speed: 28, bounciness: 6, useNativeDriver: NATIVE_DRIVER }).start();
  }

  // Layout props describe how the control sits in its parent, so they belong on the outer
  // Pressable. Leaving percentage widths on the inner view as well would compound them
  // (23% of 23%), which is what collapsed the time and calendar grids.
  const flat = { ...(StyleSheet.flatten(style) ?? {}) } as Record<string, unknown>;
  const outerLayout: Record<string, unknown> = {};
  for (const key of OUTER_LAYOUT_KEYS) {
    if (flat[key] !== undefined) {
      outerLayout[key] = flat[key];
      delete flat[key];
    }
  }
  const sized = ['flex', 'flexGrow', 'flexBasis', 'width', 'alignSelf'].some((k) => outerLayout[k] !== undefined);
  const inner: ViewStyle = {
    ...(flat as ViewStyle),
    flexGrow: 1,
    ...(sized ? { width: '100%' } : null),
  };

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      hitSlop={4}
      style={outerLayout as ViewStyle}
    >
      <Animated.View style={[inner, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/** Pulsing live beacon dot (60fps opacity + scale). */
export function PulseDot({ tint = color.emerald, size = 8 }: { tint?: string; size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={{ width: size * 2.2, height: size * 2.2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size * 2.2,
          height: size * 2.2,
          borderRadius: size * 1.1,
          backgroundColor: tint,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0.06] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.35] }) }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint }} />
    </View>
  );
}

export function Page({ children, style, mode = 'page', footer }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; mode?: 'page' | 'auth' | 'edge'; footer?: ReactNode;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const { height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const clock = useClockOffset();
  useEffect(() => {
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [fade]);

  return (
    <SafeAreaView edges={mode === 'edge' ? ['left', 'right'] : ['top', 'left', 'right']} style={styles.safe}>
      <View pointerEvents="none" style={styles.ambientOrb} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <Animated.View style={[
          styles.page,
          { paddingBottom: (footer ? 20 : 34) + bottom },
          mode === 'auth' && styles.auth,
          mode === 'edge' && { padding: 0, minHeight: height },
          style,
          {
            opacity: fade,
            transform: [
              { translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
            ],
          },
        ]}>
          {children}
        </Animated.View>
      </ScrollView>
      {footer && (
        <View style={[styles.stickyFooter, { paddingBottom: Math.max(14, bottom + 8) }]}>
          {footer}
        </View>
      )}
      {clock !== 0 && (
        <View pointerEvents="none" accessibilityLabel={`Demo clock ${formatOffset(clock)}`} style={styles.demoPill}>
          <Copy size={12} weight={800} tint={color.white}>{`DEMO ${formatOffset(clock)}`}</Copy>
        </View>
      )}
    </SafeAreaView>
  );
}

export function Logo({ compact = false, light = false, splash = false }: {
  compact?: boolean; light?: boolean; splash?: boolean;
}) {
  return (
    <Row gap={10}>
      <View style={[styles.logoMark, compact && styles.logoMarkSmall, splash && styles.logoMarkSplash]}>
        <Route size={splash ? 40 : compact ? 18 : 26} color={color.white} strokeWidth={2.5} />
      </View>
      <Pile gap={0}>
        <Copy tint={light ? color.white : color.navy} size={splash ? 40 : compact ? 18 : 28} weight={800}
          style={{ letterSpacing: compact ? 1.4 : 3.2 }}>JUNI</Copy>
        <Copy tint={light ? '#FF8AC4' : color.brand} size={12} weight={700}>by Jeeny</Copy>
      </Pile>
    </Row>
  );
}

export function Header({ title, subtitle, onBack, action, eyebrow }: {
  title: string; subtitle?: string; onBack?: () => void; action?: ReactNode; eyebrow?: string;
}) {
  return (
    <Row gap={12} style={styles.header}>
      {onBack ? <IconButton icon={ArrowLeft} label="Go back" onPress={onBack} size={20} /> : null}
      <View style={styles.grow}>
        {!!eyebrow && <Eyebrow tint={color.muted} size={12}>{eyebrow}</Eyebrow>}
        <Copy accessibilityRole="header" size={20} weight={800} tint={color.navy} style={{ letterSpacing: -0.4 }}>{title}</Copy>
        {!!subtitle && <Copy size={12} tint={color.muted}>{subtitle}</Copy>}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </Row>
  );
}

export function IconButton({ icon: Icon, label, onPress, size = 20, style, tint = color.navy, badgeCount }: {
  icon: LucideIcon; label: string; onPress?: () => void; size?: number; style?: StyleProp<ViewStyle>; tint?: string; badgeCount?: number;
}) {
  return (
    <ScalePressable accessibilityLabel={label} onPress={onPress} style={[styles.iconButton, style]}>
      <Icon color={tint} size={size} />
      {!!badgeCount && badgeCount > 0 && (
        <View style={styles.iconBadge}>
          <Copy size={12} weight={800} tint={color.white} style={{ fontSize: 12, lineHeight: 14 }}>
            {badgeCount > 9 ? '9+' : String(badgeCount)}
          </Copy>
        </View>
      )}
    </ScalePressable>
  );
}

export function Button({ children, onPress, tone = 'primary', disabled = false, icon: Icon, style, size = 15, trailingArrow = false }: {
  children: string; onPress?: () => void; tone?: 'primary' | 'secondary' | 'dark' | 'soft' | 'danger';
  disabled?: boolean; icon?: LucideIcon; style?: StyleProp<ViewStyle>; size?: number; trailingArrow?: boolean;
}) {
  const tint = disabled
    ? '#948EA3'
    : tone === 'secondary' || tone === 'soft'
      ? color.navy
      : color.white;
  return (
    <ScalePressable
      accessibilityLabel={children}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, styles[tone], disabled && styles.disabled, style]}
    >
      {Icon && <Icon size={18} color={tint} />}
      <Copy size={size} tint={tint} weight={750} style={[styles.buttonText, Icon || trailingArrow ? null : center]}>
        {children}
      </Copy>
      {trailingArrow && !disabled && <ArrowRight size={18} color={tint} />}
    </ScalePressable>
  );
}

export function TextLink({ children, onPress, style, size = 13, tint = color.brand }: {
  children: string; onPress?: () => void; style?: StyleProp<ViewStyle>; size?: number; tint?: string;
}) {
  return (
    <ScalePressable accessibilityLabel={children} onPress={onPress} style={[styles.textLinkHit, style]}>
      <Copy tint={tint} weight={700} size={size}>{children}</Copy>
    </ScalePressable>
  );
}

const badgeColors = {
  green: ['#E8FBF3', '#0B7A50'],
  brand: ['#FFF0F7', '#C90066'],
  violet: ['#F3E8FF', '#6D28D9'],
  rose: ['#FFF0F7', '#C90066'],
  blue: ['#EAF6FF', '#1D6FA5'],
  amber: ['#FFF6DB', '#9A5B06'],
  red: ['#FEECEB', '#C62828'],
  slate: ['#EEF1F6', '#4E5869'],
  dark: ['#392852', '#FFD1E8'],
} as const;

export function Badge({ children, tone = 'brand', icon: Icon, iconSize = 13, style }: {
  children?: string; tone?: keyof typeof badgeColors; icon?: LucideIcon; iconSize?: number; style?: StyleProp<ViewStyle>;
}) {
  const [backgroundColor, tint] = badgeColors[tone];
  return (
    <Row gap={5} style={[styles.badge, { backgroundColor }, style]}>
      {Icon && <Icon color={tint} size={iconSize} />}
      {!!children && <Copy size={12} weight={700} tint={tint}>{children}</Copy>}
    </Row>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pile gap={7}>
      <Copy size={13} tint={color.navy} weight={700}>{label}</Copy>
      <TextInput
        allowFontScaling
        {...props}
        accessibilityLabel={label}
        placeholderTextColor="#958DA6"
        style={[styles.input, focused && styles.inputFocused, props.style]}
        onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
      />
    </Pile>
  );
}

export function InfoRow({ icon: Icon, label, value, subtitle, onPress, style, actionLabel }: {
  icon: LucideIcon; label: string; value: string; subtitle?: string; onPress?: () => void; style?: StyleProp<ViewStyle>; actionLabel?: string;
}) {
  const contents = (
    <Row gap={12} style={{ flex: 1 }}>
      <View style={styles.rowIcon}><Icon color={color.brand} size={20} /></View>
      <Pile gap={2} style={styles.grow}>
        <Copy size={12} tint={color.muted} weight={600}>{label}</Copy>
        <Copy size={14} weight={800} tint={color.navy}>{value}</Copy>
        {!!subtitle && <Copy size={12} tint={color.muted}>{subtitle}</Copy>}
      </Pile>
      {!!actionLabel && <Copy size={12} weight={700} tint={color.brand}>{actionLabel}</Copy>}
      {onPress && <ChevronRight size={18} color={color.muted} />}
    </Row>
  );
  return onPress
    ? <ScalePressable accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={[styles.infoRow, style]}>{contents}</ScalePressable>
    : <View style={[styles.infoRow, style]}>{contents}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function GradientCard({ children, colors, style }: {
  children: ReactNode; colors: readonly [string, string, ...string[]]; style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient colors={colors} start={{ x: 0.05, y: 0 }} end={{ x: 0.95, y: 1 }}
      style={[styles.gradientCard, style]}>{children}</LinearGradient>
  );
}

export function Tile({ icon: Icon, size = 42, iconSize = 20, tint = color.brand, background = color.pink, style }: {
  icon: LucideIcon; size?: number; iconSize?: number; tint?: string; background?: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size / 2.8), backgroundColor: background }, style]}>
      <Icon size={iconSize} color={tint} />
    </View>
  );
}

export function Notice({ children, icon: Icon, style, tint = '#6E5010' }: {
  children: string; icon: LucideIcon; style?: StyleProp<ViewStyle>; tint?: string;
}) {
  return (
    <Row gap={10} style={[styles.notice, style]}>
      <Icon color={tint} size={18} />
      <Copy tint={tint} size={13} weight={500} style={styles.noticeCopy}>{children}</Copy>
    </Row>
  );
}

/**
 * The app's one list-choice pattern (Jeeny ride-options style): a full-width, flat row with a
 * big primary value, one short detail line, and a value or chevron on the right. Rows stack
 * with hairline dividers instead of nested cards.
 */
export function ChoiceRow({
  title, detail, detailTint, value, icon: Icon, onPress, highlight = false, last = false, accessibilityLabel,
}: {
  title: string; detail?: string; detailTint?: string; value?: string; icon?: LucideIcon;
  onPress?: () => void; highlight?: boolean; last?: boolean; accessibilityLabel?: string;
}) {
  return (
    <ScalePressable
      accessibilityLabel={accessibilityLabel ?? [title, detail, value].filter(Boolean).join(', ')}
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.choiceRow, highlight && styles.choiceRowOn, !last && !highlight && styles.choiceDivider]}
    >
      {Icon && (
        <View style={[styles.choiceIcon, highlight && { backgroundColor: color.white }]}>
          <Icon size={20} color={color.brand} />
        </View>
      )}
      <View style={styles.grow}>
        <Copy size={18} weight={800} tint={color.navy} numberOfLines={1}>{title}</Copy>
        {!!detail && <Copy size={13} weight={600} tint={detailTint ?? color.muted} numberOfLines={1}>{detail}</Copy>}
      </View>
      {value ? (
        <Copy size={17} weight={800} tint={highlight ? color.brand : color.navy}>{value}</Copy>
      ) : (
        <ChevronRight size={20} color={color.muted} />
      )}
    </ScalePressable>
  );
}

export function SectionHeading({ title, note, onPress }: { title: string; note?: string; onPress?: () => void }) {
  return (
    <Row style={styles.sectionHeading}>
      <Copy accessibilityRole="header" weight={800} size={16} tint={color.navy}>{title}</Copy>
      {!!note && (onPress
        ? <TextLink onPress={onPress} size={13}>{note}</TextLink>
        : <Copy size={12} weight={700} tint={color.brand}>{note}</Copy>)}
    </Row>
  );
}

export function Avatar({ name, index = 0, size = 38 }: { name: string; index?: number; size?: number }) {
  const palette = [
    ['#E90076', '#FFFFFF'],
    ['#271C3A', '#FFFFFF'],
    ['#7C3AED', '#FFFFFF'],
    ['#0D9462', '#FFFFFF'],
  ];
  const [backgroundColor, tint] = palette[index % palette.length];
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size / 2, backgroundColor, borderWidth: 2, borderColor: color.white }]}>
      <Copy size={13} weight={800} tint={tint}>{name.slice(0, 1).toUpperCase()}</Copy>
    </View>
  );
}

export function RouteCard({ start, end, style, onStartPress, onEndPress }: {
  start: { label: string; title: string; detail: string };
  end: { label: string; title: string; detail: string };
  style?: StyleProp<ViewStyle>;
  onStartPress?: () => void;
  onEndPress?: () => void;
}) {
  return (
    <Row gap={12} style={[styles.routeCard, style]}>
      <View style={styles.routeLine}>
        <View style={styles.routeStart} />
        <View style={styles.routeDash}>
          <Svg width={2} height="100%"><Line x1="1" x2="1" y1="0" y2="100%" stroke="#D2C7E0" strokeWidth={2} strokeDasharray="3 3" /></Svg>
        </View>
        <View style={styles.routeEnd} />
      </View>
      <Pile gap={14} style={styles.grow}>
        {onStartPress ? (
          <ScalePressable accessibilityLabel={`Change pickup, ${start.title}`} onPress={onStartPress} style={styles.routeTapRow}>
            <View style={styles.grow}><RouteStop stop={start} /></View>
            <Badge tone="brand">Change</Badge>
          </ScalePressable>
        ) : <RouteStop stop={start} />}
        <View style={styles.routeInternalDivider} />
        {onEndPress ? (
          <ScalePressable accessibilityLabel={`Change destination, ${end.title}`} onPress={onEndPress} style={styles.routeTapRow}>
            <View style={styles.grow}><RouteStop stop={end} /></View>
            <Badge tone="slate">University</Badge>
          </ScalePressable>
        ) : <RouteStop stop={end} />}
      </Pile>
    </Row>
  );
}

function RouteStop({ stop }: { stop: { label: string; title: string; detail: string } }) {
  return (
    <Pile gap={3}>
      <Copy tint={color.muted} size={12} weight={700}>{stop.label}</Copy>
      <Copy tint={color.navy} size={15} weight={800}>{stop.title}</Copy>
      <Copy tint={color.muted} size={12}>{stop.detail}</Copy>
    </Pile>
  );
}

export function ProgressBar({ value, height = 6, track = '#EAE4F2', fillTint = color.brand }: {
  value: number; height?: number; track?: string; fillTint?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${clamped}%`, height, borderRadius: height, backgroundColor: fillTint }} />
    </View>
  );
}

const captainPhoto = require('../../assets/images/captain-omar.png');

export function CaptainPhoto({ style }: { style?: StyleProp<import('react-native').ImageStyle> }) {
  return <Image accessible accessibilityLabel="Captain photo" source={captainPhoto} style={[styles.captainPhoto, style]} />;
}

export function CaptainMini({ label, title, subtitle, accessory }: {
  label: string; title: string; subtitle?: string; accessory?: ReactNode;
}) {
  return (
    <Row gap={12} style={styles.captainMini}>
      <CaptainPhoto />
      <Pile gap={2} style={styles.grow}>
        <Copy tint={color.muted} size={12} weight={700}>{label}</Copy>
        <Copy size={14} weight={800} tint={color.navy}>{title}</Copy>
        {!!subtitle && <Copy size={12} tint={color.muted}>{subtitle}</Copy>}
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
    const animation = Animated.spring(progress, {
      toValue: 1,
      damping: 22,
      stiffness: 210,
      mass: 0.9,
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <Modal transparent animationType="none" onRequestClose={onClose} presentationStyle="overFullScreen" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={onClose} style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdropTint, { opacity: progress }]} />
        </Pressable>
        <Animated.View style={[styles.sheetFrame, {
          maxHeight: height * 0.88,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height * 0.7, 0] }) }],
        }]}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <SheetHandle />
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
  icon: LucideIcon; title: string; detail: string; tone?: 'green' | 'amber' | 'red' | 'brand';
}) {
  const [background, tint] = badgeColors[tone];
  return (
    <Pile gap={8} style={{ alignItems: 'center', marginBottom: 8 }}>
      <Tile icon={icon} size={52} iconSize={26} background={background} tint={tint} style={{ marginBottom: 4 }} />
      <Copy accessibilityRole="header" size={21} weight={800} tint={color.navy} style={center}>{title}</Copy>
      <Copy size={13} tint={color.muted} style={[center, { lineHeight: 20, marginHorizontal: 10 }]}>{detail}</Copy>
    </Pile>
  );
}

export function CheckDot({ active, index }: { active: boolean; index: number }) {
  return (
    <View style={[styles.checkDot, { backgroundColor: active ? color.brand : '#EAE4F2' }]}>
      {active ? <Check size={14} color={color.white} /> : <Copy size={12} weight={800} tint={color.muted}>{index}</Copy>}
    </View>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(_err: Error, _info: ErrorInfo) {
    /* handled via recovery UI */
  }
  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={[styles.safe, { justifyContent: 'center', padding: 24 }]}>
          <Card style={{ alignItems: 'center', gap: 12, padding: 24 }}>
            <Tile icon={AlertTriangle} size={52} iconSize={26} background={color.dangerSoft} tint={color.danger} />
            <Copy size={18} weight={800} style={center}>Something interrupted this screen</Copy>
            <Copy size={13} tint={color.muted} style={center}>Tap below to reload JUNI safely.</Copy>
            <Button onPress={() => this.setState({ hasError: false })}>Try again</Button>
          </Card>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export const center: TextStyle = { textAlign: 'center' };
export const fill: ViewStyle = { flex: 1 };
export const spread: ViewStyle = { justifyContent: 'space-between' };

const styles = StyleSheet.create({
  demoPill: { position: 'absolute', top: 10, right: 14, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: color.violet, zIndex: 10 },
  safe: { flex: 1, backgroundColor: color.white },
  ambientOrb: {
    position: 'absolute', top: -110, right: -80, width: 240, height: 240, borderRadius: 120,
    backgroundColor: '#FAF2F8',
  },
  scroll: { flexGrow: 1 },
  page: { flexGrow: 1, paddingTop: 14, paddingHorizontal: spacing.page, paddingBottom: 34 },
  auth: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 },
  stickyFooter: {
    paddingHorizontal: spacing.page, paddingTop: 12, backgroundColor: color.white,
    borderTopWidth: 1, borderTopColor: color.line,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  logoMark: {
    width: 54, height: 54, borderRadius: 18, backgroundColor: color.brand, alignItems: 'center',
    justifyContent: 'center', ...shadow(10, 22, '#E9007638'),
  },
  logoMarkSmall: { width: 38, height: 38, borderRadius: 12 },
  logoMarkSplash: { width: 78, height: 78, borderRadius: 24 },
  header: { minHeight: 52, marginBottom: 18 },
  headerAction: { minWidth: 48, alignItems: 'flex-end' },
  iconButton: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: color.line,
    backgroundColor: color.white, alignItems: 'center', justifyContent: 'center',
  },
  iconBadge: {
    position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: color.brand, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: color.white,
  },
  button: {
    minHeight: spacing.button, borderRadius: radius.button, paddingHorizontal: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  buttonText: { flexShrink: 1 },
  primary: { backgroundColor: color.brand, ...shadow(8, 20, '#E9007633') },
  dark: { backgroundColor: color.navy, ...shadow(8, 20, '#271C3A2E') },
  secondary: { backgroundColor: color.white, borderWidth: 1.5, borderColor: color.line },
  soft: { backgroundColor: color.soft },
  danger: { backgroundColor: color.danger, ...shadow(8, 20, '#DC262628') },
  disabled: { backgroundColor: '#EAE4F2', borderWidth: 0 },
  textLinkHit: { minHeight: 48, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  input: {
    minHeight: 54, borderRadius: radius.field, borderColor: color.line, borderWidth: 1.5, backgroundColor: color.soft,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, fontFamily: font[500], color: color.navy,
  },
  inputFocused: { borderColor: color.brand, backgroundColor: color.white, ...shadow(0, 4, '#E900761A') },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 68 },
  rowIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: color.pink, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: radius.card, padding: 16, borderWidth: 1, borderColor: color.line,
    backgroundColor: color.white, ...shadow(6, 20, '#271C3A0A'),
  },
  gradientCard: { borderRadius: 24, padding: 20 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  notice: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: color.amberSoft },
  noticeCopy: { flex: 1, lineHeight: 19 },
  sectionHeading: { justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  choiceRow: {
    minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 4, paddingVertical: 12,
  },
  choiceRowOn: {
    paddingHorizontal: 14, marginHorizontal: -12, marginVertical: 4, borderRadius: 18, borderWidth: 2,
    borderColor: color.brand, backgroundColor: color.pink,
  },
  choiceDivider: { borderBottomWidth: 1, borderBottomColor: color.line },
  choiceIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: color.pink,
    alignItems: 'center', justifyContent: 'center',
  },
  routeCard: {
    paddingVertical: 16, paddingHorizontal: 16, borderRadius: radius.card,
    backgroundColor: color.white, borderWidth: 1, borderColor: color.line, ...shadow(6, 18, '#271C3A0A'),
  },
  routeTapRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 },
  routeInternalDivider: { height: 1, backgroundColor: color.line },
  routeLine: { alignSelf: 'stretch', alignItems: 'center', width: 20, paddingVertical: 10 },
  routeStart: { borderRadius: 8, width: 12, height: 12, borderWidth: 3.5, borderColor: color.brand, backgroundColor: color.white },
  routeDash: { flex: 1, width: 2, marginVertical: 4 },
  routeEnd: { borderRadius: 4, width: 12, height: 12, backgroundColor: color.navy },
  captainMini: { padding: 12, backgroundColor: color.soft, borderRadius: 16 },
  captainPhoto: { width: 44, height: 44, borderRadius: 14 },
  sheetHandle: { width: 42, height: 5, borderRadius: 5, backgroundColor: '#DDD6E8', alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  backdropTint: { backgroundColor: '#1710268C' },
  sheetFrame: { width: '100%', maxWidth: 440 },
  // flexShrink lets the sheet obey sheetFrame's maxHeight, so the ScrollView inside it scrolls instead of clipping.
  sheet: { flexShrink: 1, backgroundColor: color.white, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  sheetContent: { gap: 12, paddingTop: 4, paddingHorizontal: 20, paddingBottom: 28 },
  checkDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});

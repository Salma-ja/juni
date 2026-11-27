import { useRouter, type Href } from 'expo-router';
import {
  CalendarDays, ChevronRight, CircleHelp, LogOut, Star, UserRound, X, type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Copy, IconButton, ScalePressable } from '@/components/ui';
import { useAuth } from '@/features/authSession';
import { color } from '@/theme';

const NATIVE_DRIVER = Platform.OS !== 'web';
const PANEL = 300;

/** Jeeny-style side menu: slides in from the left over a dimmed backdrop. */
export function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [open, progress]);

  function close(after?: () => void) {
    Animated.timing(progress, {
      toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE_DRIVER,
    }).start(() => {
      onClose();
      after?.();
    });
  }

  const go = (href: Href) => close(() => router.navigate(href));
  const name = profile?.fullName ?? 'Student';
  const pref = profile?.gender === 'male' ? 'Boys-only' : 'Girls-only';
  const points = profile?.pointsBalance ?? 0;

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={() => close()} statusBarTranslucent>
      <View style={styles.root}>
        <View style={styles.frame}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={() => close()} style={StyleSheet.absoluteFill}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.tint, { opacity: progress }]} />
          </Pressable>
          <Animated.View style={[styles.panel, {
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-PANEL, 0] }) }],
          }]}>
            <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
              <View style={styles.top}>
                <IconButton icon={X} label="Close menu" onPress={() => close()} />
              </View>

              <ScalePressable accessibilityLabel={`${name}, view profile`} onPress={() => go('/profile')} style={styles.person}>
                <View style={styles.avatar}>
                  <Copy size={22} weight={800} tint={color.white}>{name.slice(0, 1)}</Copy>
                </View>
                <View style={{ flex: 1 }}>
                  <Copy size={18} weight={800} tint={color.navy} numberOfLines={1}>{name}</Copy>
                  <Copy size={13} tint={color.muted}>{`Verified · ${pref}`}</Copy>
                </View>
                <ChevronRight size={18} color={color.muted} />
              </ScalePressable>

              <View style={styles.list}>
                <MenuRow icon={CalendarDays} label="My trips" onPress={() => go('/rides')} />
                <MenuRow icon={Star} label="Points" value={`${points}`} onPress={() => go('/points')} />
                <MenuRow icon={UserRound} label="Profile" onPress={() => go('/profile')} />
                <MenuRow icon={CircleHelp} label="How JUNI works" onPress={() => go('/rules')} />
              </View>

              <View style={{ flex: 1 }} />
              <MenuRow
                icon={LogOut}
                label="Sign out"
                danger
                onPress={() => close(async () => { await signOut(); router.replace('/login'); })}
              />
              <Copy size={12} tint={color.muted} style={styles.foot}>JUNI by Jeeny</Copy>
            </SafeAreaView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function MenuRow({ icon: Icon, label, value, onPress, danger = false }: {
  icon: LucideIcon; label: string; value?: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <ScalePressable accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress} scaleTo={0.98} style={styles.row}>
      <Icon size={20} color={danger ? color.danger : color.navy} />
      <Copy size={16} weight={600} tint={danger ? color.danger : color.navy} style={{ flex: 1 }}>{label}</Copy>
      {!!value && <Copy size={14} weight={700} tint={color.brand}>{value}</Copy>}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  frame: { flex: 1, width: '100%', maxWidth: 430, overflow: 'hidden' },
  tint: { backgroundColor: '#1710268C' },
  panel: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: PANEL, maxWidth: '85%',
    backgroundColor: color.white, paddingHorizontal: 20,
    borderTopRightRadius: 28, borderBottomRightRadius: 28,
  },
  top: { flexDirection: 'row', paddingTop: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18, paddingVertical: 8 },
  avatar: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center',
  },
  list: { marginTop: 18, borderTopWidth: 1, borderTopColor: color.line, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56 },
  foot: { marginTop: 4, marginBottom: 16 },
});

import { useRouter } from 'expo-router';
import {
  Bell, Car, Check, CheckCircle2, ChevronRight, Clock3, Gift, Navigation, ShieldCheck, Sparkles, Users, X,
} from 'lucide-react-native';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, FlatList, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge, BottomSheet, Button, Card, Copy, fill, IconButton, Pile, ProgressBar, PulseDot, Row, ScalePressable, spread, Tile,
} from '@/components/ui';
import {
  fetchNotifications, markNotificationsRead, myBookings,
  type AppNotification, type BookingData, type Member,
} from '@/data/api';
import { formatTime } from '@/data/format';
import { useAuth } from '@/features/authSession';
import { color, shadow } from '@/theme';

const NATIVE_DRIVER = Platform.OS !== 'web';

type LiveContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  activeRide: BookingData | null;
  appNow: string | null;
  openNotifications: () => void;
  refreshLive: () => Promise<void>;
};

const LiveContext = createContext<LiveContextValue | null>(null);

export function LiveUpdatesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { profile, canEnter } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeRide, setActiveRide] = useState<BookingData | null>(null);
  const [appNow, setAppNow] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [banner, setBanner] = useState<AppNotification | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const initializedFor = useRef<string | null>(null);
  const slideY = useRef(new Animated.Value(-140)).current;

  const showBanner = useCallback((item: AppNotification) => {
    setBanner(item);
    slideY.setValue(-140);
    Animated.spring(slideY, {
      toValue: 0,
      damping: 18,
      stiffness: 190,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [slideY]);

  const dismissBanner = useCallback(() => {
    Animated.timing(slideY, {
      toValue: -150,
      duration: 220,
      useNativeDriver: NATIVE_DRIVER,
    }).start(() => setBanner(null));
  }, [slideY]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(dismissBanner, 6500);
    return () => clearTimeout(t);
  }, [banner, dismissBanner]);

  const refreshLive = useCallback(async () => {
    if (!canEnter || !profile || profile.role === 'captain') {
      setActiveRide(null);
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    const [notifRes, bookingsRes] = await Promise.all([fetchNotifications(), myBookings()]);
    if (bookingsRes.ok) {
      setAppNow(bookingsRes.data.app_now);
      const live = bookingsRes.data.active[0] ?? bookingsRes.data.upcoming[0] ?? null;
      setActiveRide(live);
    }
    if (notifRes.ok) {
      const items = notifRes.data.items;
      setNotifications(items);
      setUnreadCount(notifRes.data.unreadCount);

      if (initializedFor.current !== profile.profileId) {
        initializedFor.current = profile.profileId;
        seenIds.current = new Set(items.map((n) => n.id));
        const newestUnread = items.find((n) => !n.read_at);
        if (newestUnread) {
          showBanner(newestUnread);
        }
      } else {
        const fresh = items.find((n) => !n.read_at && !seenIds.current.has(n.id));
        items.forEach((n) => seenIds.current.add(n.id));
        if (fresh) {
          showBanner(fresh);
        }
      }
    }
  }, [canEnter, profile, showBanner]);

  useEffect(() => {
    refreshLive();
    const timer = setInterval(refreshLive, 4500);
    return () => clearInterval(timer);
  }, [refreshLive]);

  const handleOpenNotification = useCallback((item: AppNotification) => {
    markNotificationsRead(item.id).then(() => refreshLive()).catch(() => {});
    setSheetOpen(false);
    dismissBanner();
    if (item.kind === 'last_seat_points' || item.kind === 'ride_points') {
      router.navigate('/points');
      return;
    }
    if (item.booking_id) {
      router.push({ pathname: '/trip', params: { bookingId: item.booking_id } });
    }
  }, [dismissBanner, refreshLive, router]);

  const markAll = useCallback(async () => {
    await markNotificationsRead();
    await refreshLive();
  }, [refreshLive]);

  const value = useMemo<LiveContextValue>(() => ({
    notifications,
    unreadCount,
    activeRide,
    appNow,
    openNotifications: () => setSheetOpen(true),
    refreshLive,
  }), [notifications, unreadCount, activeRide, appNow, refreshLive]);

  return (
    <LiveContext.Provider value={value}>
      {children}

      {banner && (
        <Animated.View
          style={[
            styles.toastWrap,
            { top: Math.max(12, top + 8), transform: [{ translateY: slideY }] },
          ]}
        >
          <ScalePressable
            accessibilityLabel={`${banner.title}. ${banner.body}`}
            onPress={() => handleOpenNotification(banner)}
            style={styles.toastCard}
          >
            <Tile
              icon={notifIcon(banner.kind)}
              size={42}
              iconSize={20}
              background={banner.kind === 'last_seat_points' ? '#49256B' : '#3A2854'}
              tint={banner.kind === 'last_seat_points' ? '#FFE57F' : '#FF77BC'}
            />
            <Pile gap={2} style={fill}>
              <Row gap={6}>
                <PulseDot tint="#34D399" size={6} />
                <Copy size={13} weight={800} tint={color.white} numberOfLines={1} style={fill}>
                  {banner.title}
                </Copy>
              </Row>
              <Copy size={12} tint="#DBD2EB" numberOfLines={2}>{banner.body}</Copy>
            </Pile>
            <ScalePressable accessibilityLabel="Dismiss notification" onPress={dismissBanner} style={styles.toastClose}>
              <X size={16} color="#CFC5E2" />
            </ScalePressable>
          </ScalePressable>
        </Animated.View>
      )}

      {sheetOpen && (
        <NotificationsSheet
          items={notifications}
          unreadCount={unreadCount}
          onMarkAll={markAll}
          onSelect={handleOpenNotification}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </LiveContext.Provider>
  );
}

export function useLiveUpdates() {
  const ctx = useContext(LiveContext);
  if (!ctx) {
    return {
      notifications: [],
      unreadCount: 0,
      activeRide: null,
      appNow: null,
      openNotifications: () => {},
      refreshLive: async () => {},
    };
  }
  return ctx;
}

export function NotificationBell() {
  const { unreadCount, openNotifications } = useLiveUpdates();
  return <IconButton icon={Bell} label="Notifications" onPress={openNotifications} badgeCount={unreadCount} />;
}

function notifIcon(kind: AppNotification['kind']) {
  switch (kind) {
    case 'trip_accepted': return ShieldCheck;
    case 'rider_picked_up': return Users;
    case 'trip_started': return Navigation;
    case 'last_seat_points':
    case 'ride_points': return Gift;
    case 'trip_completed': return CheckCircle2;
    default: return Car;
  }
}

const NotificationItemRow = memo(function NotificationItemRow({
  item, onPress,
}: {
  item: AppNotification; onPress: () => void;
}) {
  const unread = !item.read_at;
  return (
    <ScalePressable
      accessibilityLabel={`${item.title}. ${item.body}`}
      onPress={onPress}
      style={[styles.notifCard, unread && styles.notifUnread]}
    >
      <Tile
        icon={notifIcon(item.kind)}
        size={42}
        iconSize={20}
        background={unread ? color.pink : color.soft}
        tint={unread ? color.brand : color.navy}
      />
      <Pile gap={3} style={fill}>
        <Row style={spread}>
          <Copy size={14} weight={800} tint={color.navy} style={fill}>{item.title}</Copy>
          <Copy size={12} tint={color.muted}>{formatTime(item.created_at)}</Copy>
        </Row>
        <Copy size={12} tint={color.muted} style={{ lineHeight: 18 }}>{item.body}</Copy>
      </Pile>
      {unread && <View style={styles.unreadDot} />}
    </ScalePressable>
  );
});

function NotificationsSheet({
  items, unreadCount, onMarkAll, onSelect, onClose,
}: {
  items: AppNotification[];
  unreadCount: number;
  onMarkAll: () => void;
  onSelect: (item: AppNotification) => void;
  onClose: () => void;
}) {
  const keyExtractor = useCallback((item: AppNotification) => item.id, []);
  const renderItem = useCallback(({ item }: { item: AppNotification }) => (
    <NotificationItemRow item={item} onPress={() => onSelect(item)} />
  ), [onSelect]);

  return (
    <BottomSheet onClose={onClose}>
      <Row style={spread}>
        <Pile gap={2}>
          <Copy accessibilityRole="header" size={20} weight={800} tint={color.navy}>Group live updates</Copy>
          <Copy size={12} tint={color.muted}>Instant alerts for captain acceptance, pickups & points</Copy>
        </Pile>
        {unreadCount > 0 && (
          <ScalePressable accessibilityLabel="Mark all read" onPress={onMarkAll} style={styles.markReadBtn}>
            <Copy size={12} weight={700} tint={color.brand}>Mark read</Copy>
          </ScalePressable>
        )}
      </Row>
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
            <Tile icon={Sparkles} size={46} iconSize={22} />
            <Copy size={15} weight={800} tint={color.navy}>No group alerts yet</Copy>
            <Copy size={12} tint={color.muted} style={{ textAlign: 'center' }}>
              When your captain accepts, starts driving, or picks up any group rider, live updates appear right here.
            </Copy>
          </Card>
        }
      />
      <Button tone="secondary" onPress={onClose}>Close</Button>
    </BottomSheet>
  );
}

/**
 * Live Pickup & Driver Remaining Time Widget!
 * Shows driver ETA / remaining minutes, how many people have been picked up (e.g. 2/4),
 * and interactive per-rider boarding chips.
 */
/**
 * Minutes until the driver reaches this rider's gate (or, once picked up, until campus).
 * Only meaningful while the trip is running; the ride can never take longer than the corridor time.
 */
export function driverEtaMinutes(
  b: Pick<BookingData, 'picked_up' | 'arrival_at' | 'pickup_at' | 'route_minutes'>,
  appNow?: string | null,
) {
  const nowMs = appNow ? new Date(appNow).getTime() : Date.now();
  const raw = Math.round((new Date(b.picked_up ? b.arrival_at : b.pickup_at).getTime() - nowMs) / 60000);
  return Math.max(2, Math.min(raw > 0 ? raw : b.route_minutes, b.route_minutes));
}

export function LivePickupWidget({
  booking,
  appNow,
  members,
  onPress,
  compact = false,
}: {
  booking: BookingData;
  appNow?: string | null;
  members?: Member[];
  onPress?: () => void;
  compact?: boolean;
}) {
  const pickedCount = booking.picked_up_count ?? (members ? members.filter((m) => m.picked_up).length : 0);
  const totalRiders = Math.max(booking.total_riders ?? booking.seats_taken ?? 1, 1);
  const displayMin = driverEtaMinutes(booking, appNow);

  const etaLabel = booking.status === 'in_progress'
    ? (booking.picked_up
      ? `${displayMin} min to ${booking.campus.code}`
      : `Driver ~${displayMin} min away`)
    : booking.status === 'confirmed'
      ? `Pickup at ${formatTime(booking.pickup_at)}`
      : `Awaiting driver confirmation`;

  const pct = booking.status === 'in_progress'
    ? Math.max(12, Math.round((pickedCount / totalRiders) * 100))
    : booking.status === 'confirmed'
      ? 100
      : Math.round((booking.seats_taken / Math.max(booking.capacity, 1)) * 100);

  const body = (
    <View style={[styles.widgetCard, compact && { padding: 14 }]}>
      <Row style={spread}>
        <Row gap={8}>
          <PulseDot tint={booking.status === 'in_progress' ? '#34D399' : '#FF77BC'} size={7} />
          <Copy size={12} weight={800} tint="#FFD1E8">
            {booking.status === 'in_progress'
              ? 'LIVE PICKUP TELEMETRY'
              : booking.status === 'confirmed'
                ? 'CAPTAIN CONFIRMED'
                : 'GROUP STATUS'}
          </Copy>
        </Row>
        <Badge tone="dark">{`${pickedCount}/${totalRiders} picked up`}</Badge>
      </Row>

      <Row style={[spread, { marginTop: 10 }]}>
        <Pile gap={2} style={fill}>
          <Copy size={20} weight={800} tint={color.white}>{etaLabel}</Copy>
          <Copy size={12} tint="#D7CEE6">
            {booking.captain
              ? `Captain ${booking.captain.name}${booking.vehicle ? ` · ${booking.vehicle.make_model} (${booking.vehicle.plate})` : ''}`
              : `${booking.pickup_area.name} → ${booking.campus.code}`}
          </Copy>
        </Pile>
        {onPress && <ChevronRight size={20} color="#FFD1E8" />}
      </Row>

      <View style={{ marginTop: 12 }}>
        <ProgressBar
          value={pct}
          height={7}
          track="#43325E"
          fillTint={booking.status === 'in_progress' ? '#34D399' : color.brand}
        />
      </View>

      <Row style={[spread, { marginTop: 10, flexWrap: 'wrap', gap: 6 }]}>
        {members && members.length > 0 ? (
          members.map((m, idx) => (
            <Row key={`${m.first_name}-${idx}`} gap={5} style={[styles.riderPill, m.picked_up && styles.riderPillDone]}>
              {m.picked_up ? (
                <Check size={13} color="#052E1C" />
              ) : (
                <Clock3 size={13} color="#E2D9F0" />
              )}
              <Copy size={12} weight={700} tint={m.picked_up ? '#052E1C' : color.white}>
                {m.is_you ? 'You' : m.first_name}
              </Copy>
            </Row>
          ))
        ) : (
          <Copy size={12} tint="#D7CEE6">
            {booking.status === 'in_progress'
              ? `${pickedCount} of ${totalRiders} students on board · ${Math.max(0, totalRiders - pickedCount)} remaining`
              : `${booking.seats_taken}/${booking.capacity} verified seats locked for ${booking.campus.code}`}
          </Copy>
        )}
      </Row>
    </View>
  );

  return onPress ? (
    <ScalePressable accessibilityLabel={`Live ride status: ${etaLabel}, ${pickedCount} of ${totalRiders} picked up`} onPress={onPress}>
      {body}
    </ScalePressable>
  ) : body;
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 100,
    alignItems: 'center',
  },
  toastCard: {
    width: '100%',
    maxWidth: 410,
    backgroundColor: color.navy,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#483466',
    ...shadow(12, 28, '#140B2459'),
  },
  toastClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifCard: {
    padding: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
  },
  notifUnread: {
    borderColor: color.pinkBorder,
    backgroundColor: '#FFF9FC',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: color.brand,
  },
  markReadBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: color.pink,
  },
  widgetCard: {
    backgroundColor: color.navy,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3E2D59',
    ...shadow(10, 24, '#271C3A29'),
  },
  riderPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#3B2B54',
  },
  riderPillDone: {
    backgroundColor: '#34D399',
  },
});

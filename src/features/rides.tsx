import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  AlertTriangle, ArrowLeft, Bell, Car, Check, CheckCircle2, Clock3, Coins, Copy as CopyIcon,
  LockKeyhole, MapPin, Navigation, Phone, Route, ShieldCheck, Zap,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import {
  Avatar, Badge, BottomSheet, Button, CaptainMini, CaptainPhoto, Card, center, Copy, Eyebrow, fill,
  Header, IconButton, InfoRow, Page, Pile, ProgressBar, RouteCard, Row, SectionHeading,
  SheetHandle, SheetHeading, spread, TextLink, Tile,
} from '@/components/ui';
import { color, shadow } from '@/theme';

const rideTabs = ['Upcoming', 'Active', 'Past'] as const;
type RideTab = (typeof rideTabs)[number];

export function MyRides() {
  const router = useRouter();
  const [tab, setTab] = useState<RideTab>('Upcoming');
  const [cancel, setCancel] = useState(false);
  const closeCancel = () => setCancel(false);
  return (
    <Page>
      <Header title="My rides" action={<IconButton icon={Bell} label="Notifications" />} />
      <Row gap={0} style={styles.tabs}>
        {rideTabs.map((item) => (
          <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }}
            onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}>
            <Copy size={9} weight={700} tint={tab === item ? color.navy : color.muted}>{item}</Copy>
          </Pressable>
        ))}
      </Row>
      {tab === 'Past' ? (
        <Pile gap={12}>
          <PastRide date="08 APR · 7:30 AM" route="Student Area → JUST" detail="1.50 JD · 4 students" />
          <PastRide date="02 APR · 8:10 AM" route="Al-Husn → JUST" detail="Full refund issued" cancelled />
        </Pile>
      ) : (
        <Card>
          <Row style={spread}>
            <Eyebrow tint={color.muted} size={9}>TOMORROW · 7:20 AM</Eyebrow>
            <Badge>Confirmed</Badge>
          </Row>
          <Row gap={13} style={{ marginVertical: 22 }}>
            <LinearGradient colors={[color.brand, color.brand, '#CBD8D4', '#CBD8D4']} locations={[0, 0.45, 0.45, 1]}
              style={styles.rideRouteLine} />
            <Pile gap={3} style={fill}>
              <Copy size={11} weight={800}>Student Area, Irbid</Copy>
              <Copy size={8} tint={color.muted} style={{ marginBottom: 12 }}>Pickup</Copy>
              <Copy size={11} weight={800}>JUST Main Campus</Copy>
              <Copy size={8} tint={color.muted} style={{ marginBottom: 12 }}>Destination</Copy>
            </Pile>
          </Row>
          <CaptainMini label="YOUR CAPTAIN" title="Omar Khalil" accessory={<ShieldCheck size={19} color={color.brand} />} />
          <Button style={{ marginTop: 13 }} onPress={() => router.push('/trip')}>View trip details</Button>
          <TextLink tint="#B44343" size={10} style={styles.cancelLink} onPress={() => setCancel(true)}>Cancel booking</TextLink>
        </Card>
      )}
      {cancel && (
        <BottomSheet onClose={closeCancel}>
          <SheetHandle />
          <SheetHeading icon={Clock3} tone="amber" title="Cancel your booking?" detail="Your ride is more than 12 hours away." />
          <Row style={[spread, styles.refund]}>
            <Pile gap={5}><Copy size={9} tint={color.muted}>Refund amount</Copy><Copy size={16} weight={800}>1.50 JD</Copy></Pile>
            <Badge style={{ alignSelf: 'center' }}>Full refund</Badge>
          </Row>
          <Button tone="danger" onPress={closeCancel}>Confirm cancellation</Button>
          <Button tone="secondary" onPress={closeCancel}>Keep my seat</Button>
        </BottomSheet>
      )}
    </Page>
  );
}

function PastRide({ date, route, detail, cancelled = false }: { date: string; route: string; detail: string; cancelled?: boolean }) {
  return (
    <Card style={styles.pastCard}>
      <Row style={spread}><Eyebrow tint={color.muted} size={9}>{date}</Eyebrow>
        <Badge tone={cancelled ? 'red' : 'slate'}>{cancelled ? 'Cancelled' : 'Completed'}</Badge></Row>
      <Copy size={14} weight={800} style={{ marginTop: 8 }}>{route}</Copy>
      <Copy size={9} tint={color.muted}>{detail}</Copy>
    </Card>
  );
}

export function TripDetails() {
  const router = useRouter();
  return (
    <Page>
      <Header title="Trip details" onBack={() => router.dismissTo('/rides')} />
      <Row style={[spread, { marginBottom: 12 }]}>
        <Row gap={5}><View style={styles.statusDot} /><Eyebrow size={8}>CONFIRMED</Eyebrow></Row>
        <Copy size={9} weight={800}>Tomorrow · 7:20 AM</Copy>
      </Row>
      <Row gap={12} style={styles.captainCard}>
        <CaptainPhoto style={styles.captainPhoto} />
        <Pile gap={4} style={fill}>
          <Badge icon={ShieldCheck}>Licensed captain</Badge>
          <Copy size={15} weight={800} tint={color.white} style={{ marginTop: 4 }}>Omar Khalil</Copy>
          <Copy size={8} tint="#C2B8CE">Toyota Prius · White</Copy>
          <Pile gap={1} style={styles.plate}><Copy size={10} weight={800} tint={color.navy}>21-84567</Copy>
            <Copy size={5} weight={700} tint={color.navy} style={center}>JORDAN</Copy></Pile>
        </Pile>
        <IconButton icon={Phone} label="Call Captain Omar" tint="#FF83C1" style={styles.darkPhone} />
      </Row>
      <RouteCard style={styles.journey}
        start={{ label: 'PICKUP · 7:20 AM', title: 'Student Area, Irbid', detail: 'Near Al-Husn Road' }}
        end={{ label: 'ARRIVAL · ETA 7:52 AM', title: 'JUST Main Campus', detail: 'South Gate' }}
      />
      <Row gap={10}>
        <TripStat icon={Clock3} title="TRIP TIME" detail="32 min" />
        <TripStat icon={Coins} title="YOUR FARE" detail="1.50 JD" />
      </Row>
      <SectionHeading title="Group members" note="4/4 verified" />
      <Row gap={19} style={{ alignItems: 'flex-start' }}>
        {['S', 'L', 'R', 'N'].map((letter, index) => (
          <View key={letter}>
            <Avatar name={letter} index={index} />
            <View style={styles.avatarCheck}><Check size={11} color={color.white} /></View>
            {index === 0 && <Copy size={7} style={[center, { marginTop: 3 }]}>You</Copy>}
          </View>
        ))}
      </Row>
      <Row gap={9} style={{ marginTop: 22 }}>
        <Button icon={Navigation} style={styles.tripAction} size={11} onPress={() => router.push('/tracking')}>Track live</Button>
        <Button tone="secondary" icon={ShieldCheck} style={styles.tripAction} size={11} onPress={() => router.push('/safety')}>Safety & share</Button>
      </Row>
    </Page>
  );
}

function TripStat({ icon: Icon, title, detail }: { icon: typeof Clock3; title: string; detail: string }) {
  return (
    <Row gap={9} style={styles.stat}>
      <Icon size={19} color={color.brand} />
      <Pile gap={4}><Copy size={7} tint={color.muted}>{title}</Copy><Copy size={10} weight={800} tint={color.navy}>{detail}</Copy></Pile>
    </Row>
  );
}

export function Tracking() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  return (
    <Page mode="edge" style={styles.trackingPage}>
      <LinearGradient colors={['#DFEAE5', '#ECF2EE']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
        style={[styles.trackingMap, { height: height * 0.64 }]}>
        <Svg viewBox="0 0 390 520" preserveAspectRatio="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Path d="M-45 68L440 334 M98 555L253 -36" stroke="#FFFFFF80" strokeWidth={16} />
          <Path d="M-70 175L278 291 M90 494L460 235 M180 110L281 327" stroke="#FFFFFFCC" strokeWidth={12} />
          <Path d="M70 470 C110 390, 40 310, 145 260 S300 210, 322 74"
            fill="none" stroke={color.brand} strokeWidth={7} strokeLinecap="round" strokeDasharray="1 11" />
        </Svg>
        <IconButton icon={ArrowLeft} label="Go back" size={21} onPress={() => router.dismissTo('/trip')}
          style={[styles.mapBack, { top: top + 18 }]} />
        <Badge tone="violet" icon={Zap} style={[styles.mapBadge, { top: top + 22 }]}>Simulated GPS tracking</Badge>
        <View style={styles.mapStart}><MapPin size={24} color={color.brand} fill={color.brand} /></View>
        <View style={styles.carMarker}><Car size={21} color={color.white} /></View>
        <View style={styles.mapEnd}><Copy weight={800} tint={color.white}>J</Copy></View>
        <Copy weight={800} size={8} style={styles.campusMapLabel}>JUST Campus</Copy>
      </LinearGradient>
      <View style={[styles.trackingSheet, { minHeight: height * 0.38, paddingBottom: 25 + bottom }]}>
        <SheetHandle />
        <Row style={spread}>
          <Pile gap={3}><Copy size={8} weight={700} tint={color.muted}>ARRIVING IN</Copy>
            <Copy size={26} weight={800} style={{ letterSpacing: -1.04 }}>18 min</Copy></Pile>
          <Badge style={{ alignSelf: 'center' }}>On time</Badge>
        </Row>
        <View style={{ marginVertical: 14 }}><ProgressBar value={58} /></View>
        <CaptainMini label="CAPTAIN OMAR · 21-84567" title="Heading to JUST South Gate"
          accessory={<IconButton icon={Phone} label="Call Captain Omar" tint={color.brand} style={styles.lightPhone} size={18} />} />
        <Button tone="secondary" icon={ShieldCheck} style={{ marginTop: 12 }} onPress={() => router.push('/safety')}>Safety & share</Button>
      </View>
    </Page>
  );
}

export function Safety() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [sos, setSos] = useState<'idle' | 'confirm' | 'sent'>('idle');
  const closeSos = () => setSos('idle');
  return (
    <Page>
      <Header title="Safety center" onBack={() => router.dismissTo('/trip')} />
      <Pile gap={5} style={styles.safetyHero}>
        <ShieldCheck size={36} color={color.brand} style={{ marginBottom: 4 }} />
        <Copy accessibilityRole="header" size={19} weight={800} style={center}>We’re with you on every ride.</Copy>
        <Copy size={10} tint={color.muted} style={center}>Share your trip or get help quickly.</Copy>
      </Pile>
      <Card style={styles.safetyCard}>
        <Row gap={11}>
          <Tile icon={Route} size={46} iconSize={22} />
          <Pile gap={4} style={fill}>
            <Copy size={13} weight={800}>Share live trip</Copy><Copy size={8} tint={color.muted}>Private link · expires after arrival</Copy>
          </Pile>
        </Row>
        <Pile gap={4} style={styles.sharePreview}>
          <Copy size={10} weight={700}>Salma’s JUNI trip to JUST</Copy>
          <Copy size={8} tint={color.muted}>ETA 7:52 AM · Captain & vehicle only</Copy>
        </Pile>
        <Button tone="secondary" icon={copied ? Check : CopyIcon} onPress={() => setCopied(true)}>
          {copied ? 'Secure link copied' : 'Copy secure share link'}
        </Button>
        <Row gap={5} style={styles.privacy}><LockKeyhole size={14} color={color.muted} />
          <Copy size={7} tint={color.muted}>Other students’ private data stays hidden.</Copy></Row>
      </Card>
      <Card style={[styles.safetyCard, styles.sosCard]}>
        <Eyebrow>EMERGENCY SUPPORT</Eyebrow>
        <Pressable accessibilityRole="button" accessibilityLabel="SOS, press for emergency help"
          style={styles.sosButton} onPress={() => setSos('confirm')}>
          <AlertTriangle size={30} color={color.white} />
          <Copy size={27} weight={800} tint={color.white}>SOS</Copy>
          <Copy size={7} tint={color.white}>Press for emergency help</Copy>
        </Pressable>
        <Copy tint={color.muted} size={8} style={center}>We’ll confirm before sending to prevent accidental alerts.</Copy>
      </Card>
      <InfoRow icon={Phone} label="Need non-emergency help?" value="Contact JUNI support" onPress={() => {}} />
      {sos !== 'idle' && (
        <BottomSheet onClose={closeSos}>
          {sos === 'confirm' ? (
            <>
              <SheetHeading icon={AlertTriangle} title="Send SOS alert?" tone="red"
                detail="This demo will log an emergency safety event with your trip ID and current timestamp." />
              <Button tone="danger" onPress={() => setSos('sent')}>Yes, send SOS alert</Button>
              <Button tone="secondary" onPress={closeSos}>Cancel</Button>
            </>
          ) : (
            <>
              <SheetHeading icon={CheckCircle2} title="Safety alert logged"
                detail="Event SAFE-0415-0729 was recorded for trip JUNI-0415. This is an MVP simulation." />
              <Button onPress={closeSos}>Done</Button>
            </>
          )}
        </BottomSheet>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  tabs: { marginBottom: 18, padding: 4, borderRadius: 12, backgroundColor: '#F1F4F3' },
  tab: { flex: 1, paddingVertical: 9, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: color.white, ...shadow(2, 8, '#20343012') },
  pastCard: { gap: 6, backgroundColor: '#FAFAFB' },
  rideRouteLine: { width: 3, alignSelf: 'stretch', borderRadius: 3 },
  cancelLink: { alignItems: 'center', marginTop: 13 },
  refund: { marginVertical: 8, padding: 14, borderRadius: 13, backgroundColor: color.pink },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.brand, boxShadow: '0px 0px 0px 4px #FFF0F7' },
  captainCard: { padding: 15, backgroundColor: color.navy, borderRadius: 18 },
  captainPhoto: { width: 69, height: 80, borderRadius: 14 },
  plate: { borderRadius: 4, paddingVertical: 4, paddingHorizontal: 6, alignSelf: 'flex-start', marginTop: 4, backgroundColor: color.white },
  darkPhone: { width: 35, height: 35, borderRadius: 11, borderWidth: 0, backgroundColor: '#FFFFFF1A' },
  journey: { marginVertical: 13, backgroundColor: '#F5F8F7' },
  stat: { flex: 1, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: color.line },
  avatarCheck: { position: 'absolute', width: 15, height: 15, borderRadius: 8, top: 23, right: -3, alignItems: 'center', justifyContent: 'center', backgroundColor: color.brand },
  tripAction: { flex: 1, paddingHorizontal: 11 },
  trackingPage: { backgroundColor: '#DCE9E4' },
  trackingMap: { overflow: 'hidden' },
  mapBack: { position: 'absolute', left: 18, width: 41, height: 41, borderWidth: 0, ...shadow(5, 15, '#18342E1F') },
  mapBadge: { position: 'absolute', left: 72 },
  mapStart: { position: 'absolute', left: '14.6%', bottom: 28 },
  mapEnd: { position: 'absolute', right: '12.3%', top: '12.3%', width: 34, height: 34, borderRadius: 10, borderWidth: 4, borderColor: color.white, backgroundColor: color.navy, alignItems: 'center', justifyContent: 'center' },
  campusMapLabel: { position: 'absolute', right: '8.5%', top: '19.8%', backgroundColor: color.white, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 6 },
  carMarker: { position: 'absolute', top: '48%', left: '47%', width: 45, height: 45, borderRadius: 23, borderWidth: 4, borderColor: color.white, alignItems: 'center', justifyContent: 'center', backgroundColor: color.brand, transform: [{ rotate: '-15deg' }], ...shadow(6, 15, '#89004840') },
  trackingSheet: { marginTop: -20, paddingTop: 12, paddingHorizontal: 20, backgroundColor: color.white, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  lightPhone: { width: 33, height: 33, borderWidth: 0, backgroundColor: color.pink },
  safetyHero: { paddingTop: 7, paddingBottom: 21, paddingHorizontal: 20, alignItems: 'center' },
  safetyCard: { marginBottom: 13, borderRadius: 17 },
  sharePreview: { marginVertical: 14, padding: 12, backgroundColor: '#F4F7F6', borderRadius: 11 },
  privacy: { marginTop: 10, justifyContent: 'center' },
  sosCard: { alignItems: 'center', backgroundColor: '#FFF8F7', borderColor: '#F3D8D5' },
  sosButton: { width: 130, height: 130, marginTop: 13, marginBottom: 9, borderRadius: 65, borderWidth: 8, borderColor: '#FFE3E1', backgroundColor: '#D84343', justifyContent: 'center', alignItems: 'center', ...shadow(8, 24, '#D2373733') },
});

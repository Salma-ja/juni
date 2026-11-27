import { useRouter } from 'expo-router';
import { AlertTriangle, Check, CheckCircle2, Clock3, CreditCard, Info, LockKeyhole, X, Zap } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Badge, Button, Card, center, CheckDot, Copy, Eyebrow, fill, Header, IconButton,
  Notice, Page, Pile, Row, spread,
} from '@/components/ui';
import { RouteTitle } from '@/features/planning';
import { useRideSchedule } from '@/features/rideSchedule';
import { color } from '@/theme';

const ruleChecks = [
  ['Student verified', 'JUST account confirmed'],
  ['Seat available', '1 of 4 seats remaining'],
  ['Gender preference matched', 'Girls-only group'],
  ['Fare locked', '1.50 JD — no surge pricing'],
] as const;

export function BookingSummary() {
  const router = useRouter();
  const schedule = useRideSchedule();
  return (
    <Page>
      <Header title="Review booking" onBack={() => router.dismissTo('/group')} />
      <View style={styles.summaryRoute}>
        <Copy size={9} weight={700} tint="#F2A3CC">{schedule.departureDate}</Copy>
        <RouteTitle light pickup="Pickup" destination={schedule.campus.code} />
        <Copy size={10} tint="#CFC5DA">{`${schedule.departure} · Est. arrival ${schedule.arrival}`}</Copy>
      </View>
      <Card style={styles.ruleChecks}>
        <Eyebrow>AUTOMATIC RULE CHECK</Eyebrow>
        {ruleChecks.map(([label, detail]) => (
          <Row key={label} gap={10}>
            <View style={styles.ruleIcon}><Check size={11} color={color.white} /></View>
            <Pile gap={4} style={fill}>
              <Copy size={11} weight={800}>{label}</Copy>
              <Copy size={8} tint={color.muted}>{detail}</Copy>
            </Pile>
          </Row>
        ))}
      </Card>
      <Card style={styles.price}>
        <Copy size={13} weight={800}>Payment summary</Copy>
        <SummaryLine label="Seat fare" value="1.50 JD" />
        <SummaryLine label="Service fee" value="0.00 JD" />
        <View style={styles.priceDivider} />
        <SummaryLine label="Total prepaid" value="1.50 JD" total />
      </Card>
      <Notice icon={LockKeyhole} tint="#557068" style={styles.secureNote}>Your seat is held for 5 minutes during payment.</Notice>
      <Button icon={CreditCard} style={styles.sticky} onPress={() => router.push({ pathname: '/payment', params: schedule.params })}>Confirm payment</Button>
    </Page>
  );
}

function SummaryLine({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return (
    <Row style={spread}>
      <Copy size={total ? 13 : 10} tint={total ? color.ink : color.muted}>{label}</Copy>
      <Copy size={total ? 13 : 10} weight={800}>{value}</Copy>
    </Row>
  );
}

export function Payment() {
  const router = useRouter();
  const schedule = useRideSchedule();
  const [failed, setFailed] = useState(false);
  return (
    <Page>
      <Header title="Payment simulation" onBack={() => router.dismissTo('/summary')} />
      <DemoBanner icon={Zap} title="MVP demo mode" detail="No real money will be charged." />
      <Pile gap={8} style={styles.paymentAmount}>
        <Eyebrow size={9} tint={color.muted}>AMOUNT TO PAY</Eyebrow>
        <Copy size={42} weight={800} style={{ letterSpacing: -2.1 }}>
          1.50 <Copy size={14} weight={800}>JD</Copy>
        </Copy>
        <Copy size={10} tint={color.muted}>{`One seat · ${schedule.departureDate} at ${schedule.departure}`}</Copy>
        <Copy size={10} tint={color.muted}>{schedule.campus.label}</Copy>
      </Pile>
      <Card style={styles.identifiers}>
        <Identifier label="Payment ID" value="PAY-83J1-024" />
        <Identifier label="Booking ID" value="JUNI-0415-0720" />
      </Card>
      {failed && (
        <Row gap={9} style={styles.error}>
          <AlertTriangle size={20} color="#A63737" />
          <Pile gap={5} style={fill}>
            <Copy size={10} weight={800} tint="#A63737">Payment wasn’t completed</Copy>
            <Copy size={8} tint="#A63737" style={{ lineHeight: 12 }}>
              Your seat was not locked. Try the success flow or return to your booking.
            </Copy>
          </Pile>
          <IconButton icon={X} label="Dismiss payment error" size={16} tint="#BD3D3D"
            style={styles.errorClose} onPress={() => setFailed(false)} />
        </Row>
      )}
      <Pile gap={10} style={styles.simulation}>
        <Eyebrow>CHOOSE A TEST OUTCOME</Eyebrow>
        <Button icon={CheckCircle2} onPress={() => router.push({ pathname: '/status', params: schedule.params })}>Simulate payment success</Button>
        <Button icon={AlertTriangle} tone="secondary" onPress={() => setFailed(true)}>Simulate payment failure</Button>
      </Pile>
      <Copy size={8} tint="#929E9B" style={[center, { marginTop: 8 }]}>This payment screen is for product testing only.</Copy>
    </Page>
  );
}

function Identifier({ label, value }: { label: string; value: string }) {
  return <Row style={spread}>
    <Copy size={9} tint={color.muted}>{label}</Copy><Copy size={10} weight={700} tint={color.navy}>{value}</Copy>
  </Row>;
}

function DemoBanner({ icon: Icon, title, detail, subtle = false }: {
  icon: LucideIcon; title: string; detail: string; subtle?: boolean;
}) {
  const tint = subtle ? '#576D68' : '#634EB5';
  return <Row gap={11} style={[styles.demo, subtle && styles.subtle]}>
    <Icon size={18} color={tint} />
    <Pile gap={4} style={fill}>
      <Copy size={11} weight={800} tint={tint}>{title}</Copy>
      <Copy size={8} tint={tint} style={{ opacity: 0.8 }}>{detail}</Copy>
    </Pile>
  </Row>;
}

const bookingSteps = ['Searching', 'Group suggested', 'Group full · 4/4', 'Awaiting captain confirmation', 'Confirmed'];

export function BookingStatus() {
  const router = useRouter();
  const schedule = useRideSchedule();
  const [confirmed, setConfirmed] = useState(false);
  const Icon = confirmed ? CheckCircle2 : Clock3;
  return (
    <Page>
      <Header title="Booking status" onBack={() => router.dismissTo('/home')} />
      <Pile gap={9} style={[styles.statusHero, confirmed && styles.confirmed]}>
        <Icon size={31} color={confirmed ? color.brand : color.amber} />
        <Badge tone={confirmed ? 'green' : 'amber'} style={styles.centered}>{confirmed ? 'CONFIRMED' : 'AWAITING CAPTAIN'}</Badge>
        <Copy accessibilityRole="header" size={20} weight={800} tint={color.navy} style={center}>
          {confirmed ? 'Your ride is confirmed' : 'Your group is ready'}
        </Copy>
        <Copy size={10} tint={color.muted} style={[center, { lineHeight: 15 }]}>
          {confirmed ? 'Captain Omar will meet you tomorrow.' : 'We’re assigning a licensed captain to your full group.'}
        </Copy>
      </Pile>
      <View style={styles.steps}>
        <Row style={spread}><Copy size={13} weight={800}>Group status</Copy><Badge>Complete</Badge></Row>
        <View>
          <View style={styles.stepTrack} />
          {bookingSteps.map((step, index) => {
            const active = confirmed || index < 4;
            return (
              <Row key={step} gap={11} style={styles.step}>
                <CheckDot active={active} index={index + 1} />
                <Pile gap={4} style={fill}>
                  <Copy size={10} weight={800} style={{ marginTop: 4 }}>{step}</Copy>
                  {index === 2 && <Copy size={8} tint="#B07725">Group complete does not mean trip confirmed</Copy>}
                </Pile>
              </Row>
            );
          })}
        </View>
      </View>
      <DemoBanner icon={Info} title="Captain assignment is simulated" detail="For the JUNI MVP demonstration." subtle />
      {confirmed
        ? <Button style={{ marginTop: 13 }} onPress={() => router.push({ pathname: '/trip', params: schedule.params })}>View trip details</Button>
        : <Button style={{ marginTop: 13 }} onPress={() => setConfirmed(true)}>Simulate captain confirmation</Button>}
    </Page>
  );
}

const styles = StyleSheet.create({
  summaryRoute: { padding: 20, borderRadius: 18, backgroundColor: color.navy },
  ruleChecks: { marginVertical: 16, gap: 13, borderRadius: 17, padding: 17 },
  ruleIcon: { width: 17, height: 17, borderRadius: 9, backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center' },
  price: { gap: 11, borderRadius: 16, padding: 16, borderWidth: 0, backgroundColor: '#F4F7F6' },
  priceDivider: { height: 1, backgroundColor: '#D9E3DF', marginVertical: 2 },
  secureNote: { backgroundColor: color.pink, marginTop: 13 },
  sticky: { marginTop: 24 },
  demo: { padding: 13, borderRadius: 14, backgroundColor: '#F1EDFF' },
  subtle: { backgroundColor: '#F1F5F4' },
  paymentAmount: { alignItems: 'center', paddingTop: 36, paddingBottom: 27 },
  identifiers: { gap: 24, paddingVertical: 19, paddingHorizontal: 14, borderRadius: 14 },
  error: { borderRadius: 13, marginTop: 13, backgroundColor: '#FFEFEE', padding: 13, alignItems: 'flex-start' },
  errorClose: { width: 27, height: 27, borderWidth: 0, backgroundColor: 'transparent' },
  simulation: { marginTop: 24, padding: 17, backgroundColor: '#F7F9F8', borderRadius: 16 },
  statusHero: { paddingVertical: 25, paddingHorizontal: 18, alignItems: 'center', borderRadius: 20, backgroundColor: '#FFF7E4' },
  confirmed: { backgroundColor: color.pink },
  centered: { alignSelf: 'center' },
  steps: { paddingVertical: 20, paddingHorizontal: 6, gap: 13 },
  step: { minHeight: 45, alignItems: 'flex-start' },
  stepTrack: { position: 'absolute', top: 20, bottom: 42, width: 1, left: 11, backgroundColor: '#DCE4E2' },
});

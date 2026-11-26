import { useRouter } from 'expo-router';
import { AlertTriangle, Check, X } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { Badge, Button, Card, Copy, fill, Header, Page, Pile, Row } from '@/components/ui';
import { color } from '@/theme';

export function RulesShowcase() {
  const router = useRouter();
  return (
    <Page>
      <Header title="System states" eyebrow="EDGE CASE SHOWCASE" onBack={() => router.dismissTo('/home')} />
      <Pile gap={8} style={{ marginBottom: 25 }}>
        <Copy accessibilityRole="header" size={28} weight={800} style={{ letterSpacing: -1.12, lineHeight: 33 }}>
          Clear outcomes, no surprises.
        </Copy>
        <Copy size={14} tint={color.muted} style={{ lineHeight: 22 }}>Every critical rule is explained at the moment it matters.</Copy>
      </Pile>
      <Pile gap={12}>
        <Card style={styles.card}>
          <StateNumber>01</StateNumber>
          <Badge tone="red">Group full</Badge>
          <StateCopy title="4/4 seats taken" detail="This group can’t accept another booking." />
          <Button disabled size={10} style={styles.action}>Join group</Button>
        </Card>
        <Card style={styles.card}>
          <StateNumber>02</StateNumber>
          <Badge tone="rose">Preference mismatch</Badge>
          <StateCopy title="Girls-only group" detail="Your saved preference doesn’t match this group’s restriction." />
          <Row gap={7} style={styles.alert}>
            <AlertTriangle size={16} color="#B34444" /><Copy size={9} weight={700} tint="#B34444">Choose another group</Copy>
          </Row>
        </Card>
        <Card style={styles.card}>
          <StateNumber>03</StateNumber>
          <Badge tone="amber">Seat conflict</Badge>
          <StateCopy title="That seat was just booked" detail="Another student completed payment first. You were not charged." />
          <Button tone="secondary" size={10} style={styles.action}>See other groups</Button>
        </Card>
        <Card style={styles.card}>
          <StateNumber>04</StateNumber>
          <Copy size={15} weight={800} style={{ marginTop: 13, marginBottom: 8 }}>Cancellation cutoff</Copy>
          <Row gap={8}>
            <Cutoff label="12+ hours" detail="Full refund · 1.50 JD" />
            <Cutoff label="Less than 12 hours" detail="No refund" late />
          </Row>
        </Card>
      </Pile>
    </Page>
  );
}

function StateNumber({ children }: { children: string }) {
  return <Copy accessible={false} size={36} weight={800} tint="#EDF2F0" style={styles.number}>{children}</Copy>;
}

function StateCopy({ title, detail }: { title: string; detail: string }) {
  return (
    <Pile gap={5} style={{ marginTop: 13, marginBottom: 13 }}>
      <Copy size={15} weight={800}>{title}</Copy>
      <Copy size={9} tint={color.muted} style={{ lineHeight: 14 }}>{detail}</Copy>
    </Pile>
  );
}

function Cutoff({ label, detail, late = false }: { label: string; detail: string; late?: boolean }) {
  const Icon = late ? X : Check;
  return (
    <Row gap={8} style={[styles.cutoff, late && { backgroundColor: '#FFF0EF' }]}>
      <Icon size={18} color={late ? '#BD4444' : color.brand} />
      <Pile gap={3} style={fill}><Copy size={9} weight={800} tint={color.navy}>{label}</Copy>
        <Copy size={7} tint={color.muted}>{detail}</Copy></Pile>
    </Row>
  );
}

const styles = StyleSheet.create({
  card: { padding: 17, borderRadius: 17 },
  number: { position: 'absolute', right: 13, top: 9 },
  action: { minHeight: 42 },
  alert: { padding: 10, borderRadius: 10, backgroundColor: '#FFF0EF' },
  cutoff: { flex: 1, padding: 12, borderRadius: 11, backgroundColor: color.pink },
});

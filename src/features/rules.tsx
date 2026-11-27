import { useRouter } from 'expo-router';
import { AlertTriangle, Check, X } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { Badge, Button, Card, Copy, fill, Header, Page, Pile, Row } from '@/components/ui';
import { color } from '@/theme';

export function RulesShowcase() {
  const router = useRouter();
  return (
    <Page>
      <Header title="System guarantees" eyebrow="SERVER ENFORCED" onBack={() => router.dismissTo('/home')} />
      <Pile gap={6} style={{ marginBottom: 20 }}>
        <Copy accessibilityRole="header" size={24} weight={800} tint={color.navy}>
          Transparent rules, enforced in PostgreSQL.
        </Copy>
        <Copy size={14} tint={color.muted} style={{ lineHeight: 21 }}>
          Every seat lock, gender isolation check, and cancellation cutoff is guaranteed server-side.
        </Copy>
      </Pile>
      <Pile gap={12}>
        <Card style={styles.card}>
          <Badge tone="red">Group full</Badge>
          <StateCopy title="4/4 seats locked" detail="Row locks prevent double-booking the final seat." />
          <Button disabled style={styles.action}>Seat unavailable</Button>
        </Card>
        <Card style={styles.card}>
          <Badge tone="rose">Gender isolation</Badge>
          <StateCopy title="Girls-only & Boys-only" detail="Strictly separated on the server — mixed groups are rejected." />
          <Row gap={8} style={styles.alert}>
            <AlertTriangle size={18} color={color.danger} />
            <Copy size={13} weight={700} tint={color.danger}>Enforced per verified profile</Copy>
          </Row>
        </Card>
        <Card style={styles.card}>
          <Copy size={16} weight={800} tint={color.navy} style={{ marginBottom: 8 }}>12-hour cancellation rule</Copy>
          <Row gap={8}>
            <Cutoff label="12+ hours" detail="100% free cancel" />
            <Cutoff label="Under 12 hours" detail="Seat stays locked" late />
          </Row>
        </Card>
      </Pile>
    </Page>
  );
}

function StateCopy({ title, detail }: { title: string; detail: string }) {
  return (
    <Pile gap={4} style={{ marginVertical: 10 }}>
      <Copy size={16} weight={800} tint={color.navy}>{title}</Copy>
      <Copy size={13} tint={color.muted} style={{ lineHeight: 19 }}>{detail}</Copy>
    </Pile>
  );
}

function Cutoff({ label, detail, late = false }: { label: string; detail: string; late?: boolean }) {
  const Icon = late ? X : Check;
  return (
    <Row gap={8} style={[styles.cutoff, late && { backgroundColor: color.dangerSoft }]}>
      <Icon size={18} color={late ? color.danger : color.brand} />
      <Pile gap={2} style={fill}>
        <Copy size={13} weight={800} tint={color.navy}>{label}</Copy>
        <Copy size={12} tint={color.muted}>{detail}</Copy>
      </Pile>
    </Row>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 20 },
  action: { minHeight: 48 },
  alert: { padding: 12, borderRadius: 14, backgroundColor: color.dangerSoft },
  cutoff: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: color.pink },
});

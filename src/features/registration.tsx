import { useRouter } from 'expo-router';
import { GraduationCap } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { Copy, Header, Page, Pile, Row, TextLink } from '@/components/ui';
import { DemoAccess } from '@/features/access';
import { color } from '@/theme';

export default function Register() {
  const router = useRouter();
  const login = () => router.dismissTo('/login');
  return (
    <Page mode="auth">
      <Header title="Campus verification" onBack={login} />
      <Row gap={8} style={styles.subtitle}>
        <GraduationCap size={18} color={color.violet} />
        <Copy size={13} weight={700} tint={color.violet}>Only for verified university students</Copy>
      </Row>
      <Copy size={14} tint={color.muted} style={{ lineHeight: 22, marginBottom: 22 }}>
        JUNI uses your Jeeny phone account paired with a verified .edu.jo university email across JUST, YU, INU, UJ & AAU.
      </Copy>
      <Pile gap={14} style={styles.footer}>
        <DemoAccess />
        <Row gap={4} style={{ justifyContent: 'center' }}>
          <Copy size={13} tint={color.muted}>Already verified?</Copy>
          <TextLink onPress={login} size={13}>Sign in</TextLink>
        </Row>
      </Pile>
    </Page>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: 12 },
  footer: { marginTop: 12 },
});

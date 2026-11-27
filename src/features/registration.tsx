import { useRouter } from 'expo-router';
import { ArrowLeft, GraduationCap } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Copy, Pile, Row, TextLink } from '@/components/ui';
import { DemoAccess } from '@/features/access';

const pink = '#E90076';
const ink = '#272039';
const muted = '#817C8D';
const purple = '#773B92';


export default function Register() {
  const router = useRouter();
  const login = () => router.dismissTo('/login');
  return (
    <SafeAreaView style={styles.screen}>
      <View pointerEvents="none" style={styles.orbit} />
      <View pointerEvents="none" style={styles.dot} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={login}
          style={styles.back}><ArrowLeft size={20} color={ink} /></Pressable>
        <Copy accessibilityRole="header" size={28} weight={800} tint={ink} style={styles.title}>Create your account</Copy>
        <Row gap={6} style={styles.subtitle}>
          <GraduationCap size={16} color={purple} />
          <Copy size={13} weight={600} tint={purple}>Only for verified university students</Copy>
        </Row>
        <Copy size={13} tint={muted} style={{ lineHeight: 20, marginBottom: 20 }}>
          Phone and university-email verification is not part of this demo build. Continue as a demo student to try JUNI.
        </Copy>
        <Pile gap={13} style={styles.footer}>
          <DemoAccess />
          <Row gap={4} style={styles.login}>
            <Copy size={13} tint={muted}>Already have an account?</Copy><TextLink tint={pink} onPress={login} size={13}>Log in</TextLink>
          </Row>
        </Pile>
      </ScrollView>
    </SafeAreaView>
  );
}




const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F5FA', overflow: 'hidden' },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 13, paddingBottom: 9 },
  orbit: { position: 'absolute', top: -141, right: -120, width: 258, height: 285, borderRadius: 180, backgroundColor: '#F0EAF4' },
  dot: { position: 'absolute', top: 128, right: -25, width: 60, height: 60, borderRadius: 30, backgroundColor: pink },
  back: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#E2DDE6', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  title: { marginTop: 17, letterSpacing: -1.05 },
  subtitle: { marginTop: 7, marginBottom: 22 },
  footer: { marginTop: 'auto', paddingTop: 24 },
  login: { justifyContent: 'center', marginBottom: 3 },
});

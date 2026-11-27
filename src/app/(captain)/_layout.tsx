import { Tabs } from 'expo-router';
import { CircleUserRound, Route, Wallet, type LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, spacing } from '@/theme';

function tabIcon(Icon: LucideIcon) {
  return ({ color: tint }: { color: string }) => <Icon size={21} color={tint} />;
}

export default function CaptainLayout() {
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs initialRouteName="driver" screenOptions={{
      headerShown: false, animation: 'fade',
      tabBarActiveTintColor: color.brand, tabBarInactiveTintColor: '#82908F',
      tabBarLabelPosition: 'below-icon', tabBarLabelStyle: styles.label, tabBarItemStyle: styles.tab,
      tabBarStyle: [styles.bar, { height: spacing.tabBar + bottom }], tabBarHideOnKeyboard: true,
    }}>
      <Tabs.Screen name="driver" options={{ title: 'Trips', tabBarIcon: tabIcon(Route) }} />
      <Tabs.Screen name="driver-earnings" options={{ title: 'Earnings', tabBarIcon: tabIcon(Wallet) }} />
      <Tabs.Screen name="driver-profile" options={{ title: 'Profile', tabBarIcon: tabIcon(CircleUserRound) }} />
      <Tabs.Screen name="driver-trip" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: color.white, borderTopColor: color.line, paddingHorizontal: 14, paddingTop: 10, elevation: 0 },
  tab: { paddingBottom: 8 },
  label: { fontFamily: font[650], fontSize: 9 },
});

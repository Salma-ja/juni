import { Tabs } from 'expo-router';
import { Car, CircleUserRound, Coins, Home, type LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, spacing } from '@/theme';

function tabIcon(Icon: LucideIcon) {
  return ({ color: tint }: { color: string }) => <Icon size={21} color={tint} />;
}

export default function TabLayout() {
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs initialRouteName="(home)" backBehavior="initialRoute" screenOptions={{
      headerShown: false,
      animation: 'fade',
      tabBarActiveTintColor: color.brand,
      tabBarInactiveTintColor: '#82908F',
      tabBarLabelPosition: 'below-icon',
      tabBarLabelStyle: styles.label,
      tabBarItemStyle: styles.tab,
      tabBarStyle: [styles.bar, { height: spacing.tabBar + bottom }],
      tabBarHideOnKeyboard: true,
      popToTopOnBlur: false,
    }}>
      <Tabs.Screen name="(home)" options={{ title: 'Home', tabBarIcon: tabIcon(Home) }} />
      <Tabs.Screen name="(rides)" options={{ title: 'My Rides', tabBarIcon: tabIcon(Car) }} />
      <Tabs.Screen name="points" options={{ title: 'Points', tabBarIcon: tabIcon(Coins) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(CircleUserRound) }} />
      <Tabs.Screen name="demo" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: color.white, borderTopColor: color.line, paddingHorizontal: 14, paddingTop: 10, elevation: 0 },
  tab: { paddingBottom: 8 },
  label: { fontFamily: font[650], fontSize: 9 },
});

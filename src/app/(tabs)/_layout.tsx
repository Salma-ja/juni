import { Tabs } from 'expo-router';
import { Car, CircleUserRound, Home, Star, type LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, spacing } from '@/theme';

function tabIcon(Icon: LucideIcon) {
  return ({ color: tint }: { color: string }) => <Icon size={22} color={tint} />;
}

export default function TabLayout() {
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs initialRouteName="(home)" backBehavior="initialRoute" screenOptions={{
      headerShown: false,
      animation: 'fade',
      tabBarActiveTintColor: color.brand,
      tabBarInactiveTintColor: color.muted,
      tabBarLabelPosition: 'below-icon',
      tabBarLabelStyle: styles.label,
      tabBarItemStyle: styles.tab,
      tabBarStyle: [styles.bar, { height: spacing.tabBar + bottom }],
      tabBarHideOnKeyboard: true,
      popToTopOnBlur: false,
    }}>
      <Tabs.Screen name="(home)" options={{ title: 'Ride', tabBarIcon: tabIcon(Home) }} />
      <Tabs.Screen name="(rides)" options={{ title: 'My trips', tabBarIcon: tabIcon(Car) }} />
      <Tabs.Screen name="points" options={{ title: 'Points', tabBarIcon: tabIcon(Star) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(CircleUserRound) }} />
      <Tabs.Screen name="demo" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: color.white,
    borderTopColor: color.line,
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 8,
    elevation: 8,
  },
  tab: { paddingBottom: 6, minHeight: 48 },
  label: { fontFamily: font[700], fontSize: 12 },
});

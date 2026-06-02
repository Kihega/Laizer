/**
 * SMSS — Owner Tab Layout
 */
import { Tabs }         from 'expo-router';
import { Platform }     from 'react-native';
import { Colors, FontSize, FontWeight, Shadows } from '@/constants/theme';

export default function OwnerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:     false,
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.grey400,
        tabBarLabelStyle: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor:  Colors.border,
          borderTopWidth:  1,
          paddingBottom:   Platform.OS === 'ios' ? 20 : 6,
          paddingTop:      6,
          height:          Platform.OS === 'ios' ? 82 : 62,
          ...Shadows.sm,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }}
      />
      <Tabs.Screen
        name="centres"
        options={{ title: 'Centres', tabBarIcon: ({ color }) => <TabIcon emoji="🏪" color={color} /> }}
      />
      <Tabs.Screen
        name="workers"
        options={{ title: 'Workers', tabBarIcon: ({ color }) => <TabIcon emoji="👥" color={color} /> }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reports', tabBarIcon: ({ color }) => <TabIcon emoji="📊" color={color} /> }}
      />
      <Tabs.Screen
        name="notices"
        options={{ title: 'Notices', tabBarIcon: ({ color }) => <TabIcon emoji="📢" color={color} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 22, opacity: color === Colors.primary ? 1 : 0.5 }}>{emoji}</Text>;
}

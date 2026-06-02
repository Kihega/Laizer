/**
 * SMSS — Worker Tab Layout
 */
import { Tabs }     from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Shadows } from '@/constants/theme';

export default function WorkerLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor:   Colors.primary,
      tabBarInactiveTintColor: Colors.grey400,
      tabBarLabelStyle: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
      tabBarStyle: {
        backgroundColor: Colors.white, borderTopColor: Colors.border, borderTopWidth: 1,
        paddingBottom: Platform.OS === 'ios' ? 20 : 6, paddingTop: 6,
        height: Platform.OS === 'ios' ? 82 : 62, ...Shadows.sm,
      },
    }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline"      size={size} color={color} /> }} />
      <Tabs.Screen name="stock"     options={{ title: 'Stock',     tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline"      size={size} color={color} /> }} />
      <Tabs.Screen name="services"  options={{ title: 'Services',  tabBarIcon: ({ color, size }) => <Ionicons name="create-outline"    size={size} color={color} /> }} />
      <Tabs.Screen name="notices"   options={{ title: 'Notices',   tabBarIcon: ({ color, size }) => <Ionicons name="megaphone-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}

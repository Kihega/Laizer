/**
 * SMSS — Worker Tab Layout
 */
import { Tabs }     from 'expo-router';
import { Platform } from 'react-native';
import { Colors, FontSize, FontWeight, Shadows } from '@/constants/theme';

export default function WorkerLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor:   Colors.primary,
      tabBarInactiveTintColor: Colors.grey400,
      tabBarLabelStyle: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold },
      tabBarStyle: {
        backgroundColor: Colors.white, borderTopColor: Colors.border, borderTopWidth:1,
        paddingBottom: Platform.OS === 'ios' ? 20 : 6, paddingTop:6,
        height: Platform.OS === 'ios' ? 82 : 62, ...Shadows.sm,
      },
    }}>
      <Tabs.Screen name="dashboard" options={{ title:'Dashboard', tabBarIcon:({color})=><TI emoji="🏠" color={color}/> }} />
      <Tabs.Screen name="stock"     options={{ title:'Stock',     tabBarIcon:({color})=><TI emoji="📦" color={color}/> }} />
      <Tabs.Screen name="services"  options={{ title:'Services',  tabBarIcon:({color})=><TI emoji="✏️"  color={color}/> }} />
      <Tabs.Screen name="notices"   options={{ title:'Notices',   tabBarIcon:({color})=><TI emoji="📢" color={color}/> }} />
    </Tabs>
  );
}
function TI({ emoji, color }: { emoji:string; color:string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize:22, opacity: color===Colors.primary?1:0.5 }}>{emoji}</Text>;
}

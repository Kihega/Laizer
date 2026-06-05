/**
 * SMSS — Worker Tab Layout  (notification badge on Notices)
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tabs }     from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Shadows } from '@/constants/theme';

function useBadge() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const m = require('./(worker)/dashboard') as { globalUnreadCount?: number };
        setN(m.globalUnreadCount ?? 0);
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, []);
  return n;
}

function BadgeIcon({ name, color, size, badge }: {
  name: React.ComponentProps<typeof Ionicons>['name']; color:string; size:number; badge:number;
}) {
  return (
    <View>
      <Ionicons name={name} size={size} color={color} />
      {badge > 0 && (
        <View style={B.dot}>
          <Text style={B.txt}>{badge > 9 ? '9+' : String(badge)}</Text>
        </View>
      )}
    </View>
  );
}

export default function WorkerLayout() {
  const unread = useBadge();
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
      <Tabs.Screen name="dashboard" options={{ title:'Dashboard', tabBarIcon: ({color,size}) => <Ionicons name="home-outline"      size={size} color={color} /> }} />
      <Tabs.Screen name="stock"     options={{ title:'Stock',     tabBarIcon: ({color,size}) => <Ionicons name="cube-outline"      size={size} color={color} /> }} />
      <Tabs.Screen name="services"  options={{ title:'Services',  tabBarIcon: ({color,size}) => <Ionicons name="create-outline"    size={size} color={color} /> }} />
      <Tabs.Screen name="notices"   options={{ title:'Notices',   tabBarIcon: ({color,size}) => <BadgeIcon name="megaphone-outline" color={color} size={size} badge={unread} /> }} />
    </Tabs>
  );
}

const B = StyleSheet.create({
  dot: { position:'absolute', top:-4, right:-6, minWidth:16, height:16, borderRadius:8, backgroundColor:Colors.error, alignItems:'center', justifyContent:'center', paddingHorizontal:3 },
  txt: { fontSize:9, fontWeight:'700' as const, color:'#fff' },
});

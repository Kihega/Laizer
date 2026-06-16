/**
 * SMSS — Root Layout
 * Hydrates auth from SecureStore, then routes to (auth) or (owner)/(worker).
 */
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  const { isAuthenticated, isLoading, user, loadStoredAuth } = useAuthStore();
  const router   = useRouter();
  const segments = useSegments();

  // Hydrate on first mount
  useEffect(() => { loadStoredAuth(); }, []);

  // Route guard
  useEffect(() => {
    if (isLoading) return;

    const inAuth   = segments[0] === '(auth)';
    const inOwner  = segments[0] === '(owner)';
    const inWorker = segments[0] === '(worker)';

    if (!isAuthenticated) {
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }

    if (user?.role === 'owner'  && !inOwner)  router.replace('/(owner)/dashboard');
    if (user?.role === 'worker' && !inWorker) router.replace('/(worker)/dashboard');
  }, [isAuthenticated, isLoading, user, segments]);

  if (isLoading) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color={Colors.white} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <Slot />
      <StatusBar style="auto" />
    </>
  );
}

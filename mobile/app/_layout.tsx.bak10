/**
 * SMSS — Root Layout
 * Hydrates auth from SecureStore, then routes to (auth) or (owner)/(worker).
 */
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, FontWeight } from '@/constants/theme';

export default function RootLayout() {
  const { isAuthenticated, isLoading, loadingStatus, user, loadStoredAuth } = useAuthStore();
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
    const stalled = loadingStatus?.startsWith('Timed out') || loadingStatus?.startsWith('Error');
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center',
                     backgroundColor: Colors.primary, padding: 32 }}>
        {!stalled && <ActivityIndicator size="large" color={Colors.white} style={{ marginBottom: 16 }} />}
        <Text style={{ color: Colors.white, fontSize: FontSize.sm,
                       fontWeight: FontWeight.medium, textAlign: 'center',
                       opacity: 0.85, marginBottom: stalled ? 20 : 0 }}>
          {loadingStatus ?? 'Loading…'}
        </Text>
        {stalled && (
          <TouchableOpacity onPress={loadStoredAuth}
            style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 28,
                     borderRadius: 8, borderWidth: 1.5, borderColor: Colors.white }}>
            <Text style={{ color: Colors.white, fontWeight: FontWeight.bold,
                           fontSize: FontSize.base }}>Retry</Text>
          </TouchableOpacity>
        )}
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

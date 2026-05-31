/**
 * SMSS — Splash / Entry (redirects immediately via root layout guard)
 */
import { Redirect } from 'expo-router';
export default function Index() { return <Redirect href="/(auth)/login" />; }

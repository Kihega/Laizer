#!/usr/bin/env python3
"""
apply_patch.py  —  Laizer / SMSS
=================================
Patch: Native Ionicons + Sign-Out Icon
Targets: mobile/app/(owner)/_layout.tsx
         mobile/app/(worker)/_layout.tsx
         mobile/app/(owner)/dashboard.tsx
         mobile/app/(worker)/dashboard.tsx

Usage
-----
    # From the repository root:
    python apply_patch.py

    # Dry-run (preview without writing):
    python apply_patch.py --dry-run

    # Undo (restore originals from .bak files):
    python apply_patch.py --undo

What it does
------------
1. Replaces the hand-rolled emoji TabIcon / TI wrapper components in
   both tab-bar layouts with proper <Ionicons> from @expo/vector-icons.
2. Replaces the plain-text "Logout" button in both dashboards with a
   TouchableOpacity + Ionicons log-out-outline icon.
3. Replaces every emoji string used in StatCard, WStatCard, and the
   Quick-Actions grids with typed Ionicons names.
4. Replaces the ⚠️ emoji in the low-stock alert with an inline
   Ionicons warning-outline icon.
5. Writes README.md at the repo root.

No third-party libraries required — stdlib only.
"""

import argparse
import os
import shutil
import sys
from pathlib import Path
from textwrap import dedent

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

def log(colour: str, tag: str, message: str) -> None:
    print(f"{colour}{BOLD}[{tag}]{RESET} {message}")

def ok(msg: str)   -> None: log(GREEN,  "  OK ", msg)
def info(msg: str) -> None: log(YELLOW, "INFO ", msg)
def err(msg: str)  -> None: log(RED,    "ERROR", msg)


def repo_root() -> Path:
    """Walk upward from this script until we find mobile/ and backend/."""
    start = Path(__file__).resolve().parent
    for candidate in [start, *start.parents]:
        if (candidate / "mobile").is_dir() and (candidate / "backend").is_dir():
            return candidate
    # Fallback: assume script lives at the repo root
    return start


def backup(path: Path) -> None:
    """Copy path → path.bak only if the file already exists (new files have no backup)."""
    if path.exists():
        shutil.copy2(path, path.with_suffix(path.suffix + ".bak"))


def restore(path: Path) -> bool:
    bak = path.with_suffix(path.suffix + ".bak")
    if bak.exists():
        shutil.copy2(bak, path)
        bak.unlink()
        return True
    return False


def write_file(path: Path, content: str, dry_run: bool) -> None:
    if dry_run:
        info(f"DRY-RUN — would write {path}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    backup(path)
    path.write_text(content, encoding="utf-8")
    ok(f"Written  {path}")


# ---------------------------------------------------------------------------
# File contents
# ---------------------------------------------------------------------------

OWNER_LAYOUT = dedent("""\
    /**
     * SMSS — Owner Tab Layout
     */
    import { Tabs }         from 'expo-router';
    import { Platform }     from 'react-native';
    import { Ionicons }     from '@expo/vector-icons';
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
            options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }}
          />
          <Tabs.Screen
            name="centres"
            options={{ title: 'Centres', tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} /> }}
          />
          <Tabs.Screen
            name="workers"
            options={{ title: 'Workers', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} /> }}
          />
          <Tabs.Screen
            name="reports"
            options={{ title: 'Reports', tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} /> }}
          />
          <Tabs.Screen
            name="notices"
            options={{ title: 'Notices', tabBarIcon: ({ color, size }) => <Ionicons name="megaphone-outline" size={size} color={color} /> }}
          />
        </Tabs>
      );
    }
""")


WORKER_LAYOUT = dedent("""\
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
""")


OWNER_DASHBOARD = dedent("""\
    /**
     * SMSS — Owner Dashboard
     * Shows daily revenue totals, centre count, and quick-action cards.
     */
    import { useCallback, useEffect, useState } from 'react';
    import {
      ActivityIndicator, RefreshControl, ScrollView,
      StyleSheet, Text, TouchableOpacity, View,
    } from 'react-native';
    import { Ionicons }          from '@expo/vector-icons';
    import { LinearGradient }    from 'expo-linear-gradient';
    import { useRouter }         from 'expo-router';
    import { useAuthStore }      from '@/store/authStore';
    import { useAuth }           from '@/hooks/useAuth';
    import { reportService, centreService } from '@/services/api';
    import { Card }              from '@/components/ui';
    import { BrandColors, Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

    function fmt(n: number) {
      return `Tshs ${n.toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;
    }

    export default function OwnerDashboard() {
      const { user }                 = useAuthStore();
      const { logout }               = useAuth();
      const router                   = useRouter();
      const [report,    setReport]   = useState<any[]>([]);
      const [centres,   setCentres]  = useState<any[]>([]);
      const [loading,   setLoading]  = useState(true);
      const [refreshing,setRefreshing] = useState(false);

      const load = useCallback(async () => {
        try {
          const [rpt, ctr] = await Promise.all([
            reportService.daily(),
            centreService.list(),
          ]);
          setReport(rpt.data);
          setCentres(ctr.data);
        } catch (e) {
          console.error('[Dashboard]', e);
        } finally { setLoading(false); setRefreshing(false); }
      }, []);

      useEffect(() => { load(); }, []);

      const totalRevenue  = report.reduce((s, r) => s + (r.totalRevenueTshs ?? 0), 0);
      const totalEvents   = report.reduce((s, r) => s + (r.totalEvents ?? 0), 0);
      const activeCentres = centres.length;

      return (
        <View style={S.root}>
          {/* Header */}
          <LinearGradient colors={[BrandColors.blueDark, BrandColors.blue]} style={S.header}>
            <View style={S.headerRow}>
              <View>
                <Text style={S.greeting}>Good day, {user?.fullName?.split(' ')[0]} 👋</Text>
                <Text style={S.subGreeting}>Here's today's overview</Text>
              </View>
              <TouchableOpacity onPress={logout} style={S.signOutBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="log-out-outline" size={24} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            {/* Stat cards */}
            <View style={S.statsRow}>
              <StatCard label="Today's Revenue" value={fmt(totalRevenue)} iconName="cash-outline" />
              <StatCard label="Services Logged" value={String(totalEvents)} iconName="list-outline" />
              <StatCard label="Active Centres"  value={String(activeCentres)} iconName="storefront-outline" />
            </View>
          </LinearGradient>

          {/* Body */}
          <ScrollView
            style={S.body}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <ActivityIndicator style={S.loader} color={Colors.primary} size="large" />
            ) : (
              <>
                {/* Quick actions */}
                <Text style={S.sectionTitle}>Quick Actions</Text>
                <View style={S.actions}>
                  {[
                    { label: 'View Centres',   iconName: 'storefront-outline' as const, route: '/(owner)/centres'  },
                    { label: 'Manage Workers', iconName: 'people-outline'     as const, route: '/(owner)/workers'  },
                    { label: 'Daily Report',   iconName: 'bar-chart-outline'  as const, route: '/(owner)/reports'  },
                    { label: 'Send Notice',    iconName: 'megaphone-outline'  as const, route: '/(owner)/notices'  },
                  ].map(a => (
                    <Card key={a.route} onPress={() => router.push(a.route as any)} style={S.actionCard}>
                      <Ionicons name={a.iconName} size={32} color={Colors.primary} style={S.actionIcon} />
                      <Text style={S.actionLabel}>{a.label}</Text>
                    </Card>
                  ))}
                </View>

                {/* Per-centre summary */}
                {report.length > 0 && (
                  <>
                    <Text style={S.sectionTitle}>Today by Centre</Text>
                    {report.map((r, i) => (
                      <Card key={i} style={S.centreCard}>
                        <View style={S.centreCardRow}>
                          <Text style={S.centreName}>{r.centre?.name ?? '—'}</Text>
                          <Text style={S.centreNo}>{r.centre?.centreNo}</Text>
                        </View>
                        <View style={S.centreStats}>
                          <Text style={S.centreRev}>{fmt(r.totalRevenueTshs)}</Text>
                          <Text style={S.centreEvents}>{r.totalEvents} services</Text>
                        </View>
                        {r.topService && (
                          <Text style={S.topService}>Top: {r.topService}</Text>
                        )}
                      </Card>
                    ))}
                  </>
                )}
              </>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      );
    }

    function StatCard({ label, value, iconName }: { label: string; value: string; iconName: React.ComponentProps<typeof Ionicons>['name'] }) {
      return (
        <View style={SS.card}>
          <Ionicons name={iconName} size={22} color="rgba(255,255,255,0.9)" style={SS.icon} />
          <Text style={SS.value}>{value}</Text>
          <Text style={SS.label}>{label}</Text>
        </View>
      );
    }

    const S = StyleSheet.create({
      root:         { flex: 1, backgroundColor: Colors.background },
      header:       { paddingTop: 60, paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
      headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xl },
      greeting:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
      subGreeting:  { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
      signOutBtn:   { paddingTop: 2 },
      statsRow:     { flexDirection: 'row', gap: Spacing.sm },
      body:         { flex: 1, padding: Spacing.xl },
      loader:       { marginTop: Spacing['3xl'] },
      sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md, marginTop: Spacing.base },
      actions:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.sm },
      actionCard:   { width: '47%', alignItems: 'center', paddingVertical: Spacing.base },
      actionIcon:   { marginBottom: Spacing.xs },
      actionLabel:  { fontSize: FontSize.sm, fontWeight: FontWeight.semiBold, color: Colors.textPrimary, textAlign: 'center' },
      centreCard:   { marginBottom: Spacing.sm },
      centreCardRow:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
      centreName:   { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
      centreNo:     { fontSize: FontSize.xs, color: Colors.textDisabled, backgroundColor: Colors.grey100, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
      centreStats:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
      centreRev:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.accent },
      centreEvents: { fontSize: FontSize.sm, color: Colors.textSecondary },
      topService:   { fontSize: FontSize.xs, color: Colors.primary, marginTop: Spacing.xs },
    });
    const SS = StyleSheet.create({
      card:  { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
      icon:  { marginBottom: 4 },
      value: { fontSize: FontSize.lg, fontWeight: FontWeight.black, color: Colors.white },
      label: { fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 2 },
    });
""")


WORKER_DASHBOARD = dedent("""\
    /**
     * SMSS — Worker: Dashboard
     */
    import { useCallback, useEffect, useState } from 'react';
    import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
    import { Ionicons }          from '@expo/vector-icons';
    import { LinearGradient }    from 'expo-linear-gradient';
    import { useRouter }         from 'expo-router';
    import { useAuthStore }      from '@/store/authStore';
    import { useAuth }           from '@/hooks/useAuth';
    import { serviceEventService, stockService, noticeService } from '@/services/api';
    import { Card, StatusBadge } from '@/components/ui';
    import { BrandColors, Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

    function fmt(n: number) { return `Tshs ${n.toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`; }

    export default function WorkerDashboard() {
      const { user }   = useAuthStore();
      const { logout } = useAuth();
      const router     = useRouter();
      const [events,    setEvents]    = useState<any[]>([]);
      const [stockLow,  setStockLow]  = useState<any[]>([]);
      const [unreadCnt, setUnreadCnt] = useState(0);
      const [loading,   setLoading]   = useState(true);
      const [refreshing,setRefreshing]= useState(false);

      const load = useCallback(async () => {
        try {
          const [ev, st, nt] = await Promise.all([
            serviceEventService.list(),
            stockService.list(),
            noticeService.list(),
          ]);
          setEvents(ev.data);
          setStockLow(st.data.filter((i: any) => Number(i.quantity) < 5));
          setUnreadCnt(nt.data.filter((n: any) => !n.isRead).length);
        } catch (e) { console.error('[WorkerDash]', e); }
        finally { setLoading(false); setRefreshing(false); }
      }, []);

      useEffect(() => { load(); }, []);

      const todayRevenue = events.reduce((s, e) => s + Number(e.totalAmountTshs), 0);

      return (
        <View style={WD.root}>
          <LinearGradient colors={[BrandColors.teal, '#0E7490']} style={WD.header}>
            <View style={WD.headerRow}>
              <View>
                <Text style={WD.greeting}>Hi, {user?.fullName?.split(' ')[0]} 👋</Text>
                <Text style={WD.sub}>Your service dashboard</Text>
              </View>
              <TouchableOpacity onPress={logout} style={WD.signOutBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="log-out-outline" size={24} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
            <View style={WD.statsRow}>
              <WStatCard label="Today's Revenue"  value={fmt(todayRevenue)}     iconName="cash-outline" />
              <WStatCard label="Services Today"   value={String(events.length)} iconName="list-outline" />
              <WStatCard label="Unread Notices"   value={String(unreadCnt)}     iconName="megaphone-outline" />
            </View>
          </LinearGradient>

          <ScrollView style={WD.body}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
            showsVerticalScrollIndicator={false}>
            {loading ? <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} /> : (
              <>
                {/* Quick Actions */}
                <Text style={WD.section}>Quick Actions</Text>
                <View style={WD.actions}>
                  {[
                    { label: 'Log Service', iconName: 'create-outline'    as const, route: '/(worker)/services' },
                    { label: 'View Stock',  iconName: 'cube-outline'      as const, route: '/(worker)/stock'    },
                    { label: 'Notices',     iconName: 'megaphone-outline' as const, route: '/(worker)/notices'  },
                  ].map(a => (
                    <Card key={a.route} onPress={() => router.push(a.route as any)} style={WD.actionCard}>
                      <Ionicons name={a.iconName} size={28} color={Colors.primary} style={WD.actionIcon} />
                      <Text style={WD.actionLabel}>{a.label}</Text>
                    </Card>
                  ))}
                </View>

                {/* Low stock warning */}
                {stockLow.length > 0 && (
                  <>
                    <View style={WD.sectionRow}>
                      <Ionicons name="warning-outline" size={16} color={Colors.warning} style={WD.warnIcon} />
                      <Text style={WD.section}>Low Stock Alert</Text>
                    </View>
                    {stockLow.slice(0, 3).map((item, i) => (
                      <Card key={i} style={{ marginBottom: Spacing.xs, borderLeftWidth: 3, borderLeftColor: Colors.warning }}>
                        <Text style={WD.lowStockItem}>{item.itemName} — {Number(item.quantity)} {item.unit} remaining</Text>
                      </Card>
                    ))}
                  </>
                )}

                {/* Recent events */}
                {events.length > 0 && (
                  <>
                    <Text style={WD.section}>Today's Services</Text>
                    {events.slice(0, 5).map((e, i) => (
                      <Card key={i} style={WD.eventCard}>
                        <View style={WD.eventRow}>
                          <StatusBadge type={e.serviceType} size="sm" />
                          <Text style={WD.eventTotal}>{fmt(Number(e.totalAmountTshs))}</Text>
                        </View>
                        <Text style={WD.eventMeta}>
                          {e.pages ? `${e.pages} pages` : ''}{e.serviceSubtype ? ` · ${e.serviceSubtype.replace('_', ' ')}` : ''}
                        </Text>
                      </Card>
                    ))}
                  </>
                )}
              </>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      );
    }

    function WStatCard({ label, value, iconName }: { label: string; value: string; iconName: React.ComponentProps<typeof Ionicons>['name'] }) {
      return (
        <View style={WSS.card}>
          <Ionicons name={iconName} size={20} color="rgba(255,255,255,0.9)" style={WSS.icon} />
          <Text style={WSS.value}>{value}</Text>
          <Text style={WSS.label}>{label}</Text>
        </View>
      );
    }

    const WD = StyleSheet.create({
      root:        { flex: 1, backgroundColor: Colors.background },
      header:      { paddingTop: 60, paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
      headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xl },
      greeting:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.white },
      sub:         { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
      signOutBtn:  { paddingTop: 2 },
      statsRow:    { flexDirection: 'row', gap: Spacing.sm },
      body:        { flex: 1, padding: Spacing.xl },
      section:     { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md, marginTop: Spacing.base },
      sectionRow:  { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.base, marginBottom: Spacing.md },
      warnIcon:    { marginRight: Spacing.xs },
      actions:     { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
      actionCard:  { flex: 1, alignItems: 'center', paddingVertical: Spacing.base },
      actionIcon:  { marginBottom: Spacing.xs },
      actionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semiBold, color: Colors.textPrimary, textAlign: 'center' },
      lowStockItem:{ fontSize: FontSize.sm, color: Colors.warning, fontWeight: FontWeight.medium },
      eventCard:   { marginBottom: Spacing.xs, paddingVertical: Spacing.sm },
      eventRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
      eventTotal:  { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.accent },
      eventMeta:   { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: 2 },
    });
    const WSS = StyleSheet.create({
      card: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
      icon: { marginBottom: 3 },
      value:{ fontSize: FontSize.md, fontWeight: FontWeight.black, color: Colors.white },
      label:{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 2 },
    });
""")


README = dedent("""\
    Laizer -- Stationery Management & Sales System
    ===============================================

    A mobile-first business operations platform for managing multi-centre
    stationery businesses in Tanzania.


    OVERVIEW
    --------
    Laizer (SMSS) is a cross-platform mobile application that digitises the
    day-to-day operations of a stationery business running across multiple
    service centres. The owner gets a single dashboard to manage centres,
    workers, stock, and revenue trends in real time. Workers on the ground
    log transactions, manage stock levels, and receive notices from the owner
    instantly -- replacing paper-based record-keeping entirely.

    Core problems it solves:
      - Manual, paper-based stock tracking across dispersed service centres
      - No real-time visibility into service trends or worker activity
      - Slow, unreliable communication between owner and centre workers


    TABLE OF CONTENTS
    -----------------
      1. Features
      2. Tech Stack
      3. Project Structure
      4. Getting Started
           4a. Prerequisites
           4b. Backend Setup
           4c. Mobile Setup
      5. Environment Variables
      6. API Reference
      7. User Roles
      8. Database Schema
      9. Deployment
     10. CI/CD
     11. Branching Strategy
     12. Future Enhancements
     13. License


    1. FEATURES
    -----------

    Owner
    -----
    Centres  : Add, edit, deactivate, and delete service centres
    Workers  : Register workers, assign/transfer between centres, deactivate
    Reports  : Daily & weekly revenue summaries, service trends, stock levels
    Notices  : Compose and send normal or urgent notices; view read receipts

    Worker
    ------
    Authentication : Log in using the assigned Centre ID (no email required)
    Stock          : Add, update, and remove stock items (pcs or boxes) with
                     Tshs pricing
    Services       : Log photocopy, printing, lamination, scanning, designing
                     events per transaction
    Notices        : View owner notices; receive push notifications for new ones


    2. TECH STACK
    -------------

    Mobile (/mobile)
      Framework          : React Native + Expo (Managed Workflow)
      Language           : TypeScript
      Navigation         : Expo Router v6 (file-based routing)
      Icons              : @expo/vector-icons -- Ionicons
      State              : Zustand
      API client         : Axios + TanStack React Query
      Push notifications : Expo Notifications
      Auth storage       : Expo SecureStore

    Backend (/backend)
      Runtime    : Node.js
      Framework  : Express.js
      Language   : JavaScript (ES modules)
      ORM        : Prisma
      Database   : PostgreSQL via Supabase (free tier)
      Caching    : In-process Map (Upstash Redis optional)
      Auth       : Custom JWT -- access token (60 min) + refresh token (7 days)
      Validation : Zod schemas on every route
      Hosting    : Render (free tier, Dockerised)


    3. PROJECT STRUCTURE
    --------------------

    Laizer/
    |-- backend/                   Express.js REST API
    |   |-- prisma/
    |   |   |-- schema.prisma      Database schema
    |   |   +-- seed.js            Seed script
    |   |-- src/
    |   |   |-- config/            Environment config
    |   |   |-- lib/               JWT, Redis, audit logger, push
    |   |   |-- middleware/        Auth guard, error handler
    |   |   +-- routes/            auth, centres, workers, stock,
    |   |                          services, reports, notices
    |   |-- Dockerfile
    |   +-- .env.example
    |
    |-- mobile/                    React Native / Expo app
    |   |-- app/
    |   |   |-- (auth)/            Login screen
    |   |   |-- (owner)/           Owner tab group
    |   |   |   |-- _layout.tsx    Owner tab bar (Ionicons)
    |   |   |   |-- dashboard.tsx
    |   |   |   |-- centres.tsx
    |   |   |   |-- workers.tsx
    |   |   |   |-- reports.tsx
    |   |   |   +-- notices.tsx
    |   |   +-- (worker)/          Worker tab group
    |   |       |-- _layout.tsx    Worker tab bar (Ionicons)
    |   |       |-- dashboard.tsx
    |   |       |-- stock.tsx
    |   |       |-- services.tsx
    |   |       +-- notices.tsx
    |   |-- components/ui/         Button, Card, Input, StatusBadge
    |   |-- constants/             theme.ts, api.ts
    |   |-- hooks/                 useAuth
    |   |-- services/              api.ts (Axios service layer)
    |   |-- store/                 authStore (Zustand)
    |   +-- .env.local.example
    |
    |-- Agile_Scrum_Files/         Sprint backlogs & retrospectives
    +-- Project_Documentation/     Architecture, system design docs


    4. GETTING STARTED
    ------------------

    4a. Prerequisites
        - Node.js >= 18
        - npm or pnpm
        - Expo CLI: npm install -g expo-cli
        - A Supabase project (free tier is sufficient)
        - Android emulator, iOS simulator, or the Expo Go app

    4b. Backend Setup

        cd backend
        npm install
        cp .env.example .env
        # Edit .env -- set DATABASE_URL, DIRECT_URL, and SECRET_KEY
        npm run setup        # generate Prisma client + migrate + seed
        npm run dev          # dev server with auto-reload
        # or
        npm start            # production mode

        The API will be available at http://localhost:8000
        Health check: GET http://localhost:8000/api/health -> { "status": "ok" }

    4c. Mobile Setup

        cd mobile
        npm install
        cp .env.local.example .env.local
        # Set EXPO_PUBLIC_API_URL:
        #   Android emulator -> http://10.0.2.2:8000
        #   iOS simulator    -> http://localhost:8000
        #   Production       -> https://your-api.onrender.com
        npm start

        Press 'a' for Android, 'i' for iOS, or scan the QR code with Expo Go.


    5. ENVIRONMENT VARIABLES
    ------------------------

    Backend -- backend/.env

      Variable                 Description
      --------                 -----------
      NODE_ENV                 Runtime environment (production / development)
      PORT                     Server port (default: 8000)
      SECRET_KEY               JWT signing secret -- 64+ random bytes
      DATABASE_URL             Supabase pooler URL (port 6543)
      DIRECT_URL               Supabase direct URL (port 5432)
      CORS_ALLOWED_ORIGINS     Comma-separated allowed origins
      JWT_ACCESS_EXPIRES_IN    Access token lifetime (e.g. 60m)
      JWT_REFRESH_EXPIRES_IN   Refresh token lifetime (e.g. 7d)

      Generate SECRET_KEY:
        node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

    Mobile -- mobile/.env.local

      Variable               Description
      --------               -----------
      EXPO_PUBLIC_API_URL    Base URL of the backend API


    6. API REFERENCE
    ----------------

    All protected routes require:  Authorization: Bearer <access_token>

    Method          Endpoint                     Auth           Description
    ------          --------                     ----           -----------
    POST            /api/auth/owner/register     Public         Register owner account
    POST            /api/auth/owner/login        Public         Owner login -> JWT pair
    POST            /api/auth/worker/login       Public         Worker login via Centre ID
    POST            /api/auth/refresh            Public         Refresh access token
    POST            /api/auth/logout             Bearer         Invalidate refresh token
    GET             /api/auth/me                 Bearer         Current user profile
    GET / POST      /api/centres                 Bearer (Owner) List / create centres
    PATCH / DELETE  /api/centres/:id             Bearer (Owner) Edit / delete a centre
    GET / POST      /api/workers                 Bearer (Owner) List / register workers
    PATCH / DELETE  /api/workers/:id             Bearer (Owner) Edit / remove a worker
    GET / POST      /api/stock                   Bearer         List / add stock items
    PATCH / DELETE  /api/stock/:id               Bearer         Edit / remove a stock item
    GET / POST      /api/services                Bearer         List / log service events
    GET             /api/reports/daily           Bearer (Owner) Daily revenue per centre
    GET             /api/reports/weekly          Bearer (Owner) Weekly trend report
    GET / POST      /api/notices                 Bearer         List / send notices
    GET             /api/health                  Public         Health check


    7. USER ROLES
    -------------

    owner   Authenticated via email + password. Full access to management and
            reporting endpoints. JWT session stored with Redis-backed TTL.

    worker  Authenticated via their assigned Centre ID only (no email needed).
            Scoped to stock and service endpoints for their assigned centre.

    Role is embedded in the JWT payload and validated by middleware on every
    protected request.


    8. DATABASE SCHEMA
    ------------------

    Built with Prisma on PostgreSQL. Core tables:

    Table           Purpose
    -----           -------
    User            Both owners and workers (role enum: owner / worker)
    Centre          Service centre with name, number, and location
    CentreWorker    Many-to-many assignment of workers to centres
    StockItem       Inventory items per centre (name, quantity, unit, price)
    ServiceEvent    Logged customer transactions (type, subtype, pages, amount)
    Notice          Owner-to-worker notices with priority levels
    NoticeRead      Per-worker read receipt for each notice
    AuditLog        Immutable record of all data-changing actions

    All monetary values are stored and displayed in Tanzanian Shillings (Tshs).


    9. DEPLOYMENT
    -------------

    Backend -- Render
      The backend ships with a Dockerfile and start.sh. Render detects the
      Dockerfile automatically on push to main.

      start.sh runs:
        1. prisma migrate deploy  (applies pending migrations)
        2. node src/server.js     (starts the server)

      Set all variables from backend/.env.example in the Render dashboard.
      Never commit .env.

    Mobile -- EAS Build
      npm install -g eas-cli
      eas build:configure               # first time only
      npm run build:android             # production APK / AAB
      npm run build:preview             # preview APK for testing

      Build profiles are defined in mobile/eas.json.


    10. CI/CD
    ---------

    Two GitHub Actions workflows in .github/workflows/:

    Workflow      Trigger             Actions
    --------      -------             -------
    ci.yml        Every pull request  ESLint + TypeScript check on
                                      backend/ and mobile/
    deploy.yml    Merge to main       Render redeploy (webhook) +
                                      EAS production build


    11. BRANCHING STRATEGY
    ----------------------

    main          <- production only, protected
      +-- develop <- integration branch; all features land here first
            +-- feature/backend-auth-routes
            +-- feature/worker-login-centre-id
            +-- feature/stock-management
            +-- feature/service-events
            +-- feature/reports-dashboard

    Workflow:
      1. Create feature branch from develop
      2. Open PR into develop; reviewed before merge
      3. End-of-sprint PR from develop -> main
      4. Merge to main triggers Render redeploy + EAS build


    12. FUTURE ENHANCEMENTS
    -----------------------

      - Customer-facing receipt generation (PDF / WhatsApp share)
      - Sales invoicing and revenue tracking
      - Worker performance analytics dashboard
      - Automated low-stock alerts
      - Multi-language support (Swahili + English)
      - Web admin dashboard (Next.js)
      - Upgrade Render to paid tier for always-on backend


    13. LICENSE
    -----------

    Private -- all rights reserved. This codebase is proprietary software
    and is not open for redistribution.


    =========================================================================
    End of README
    =========================================================================
""")


# ---------------------------------------------------------------------------
# Patch manifest
# ---------------------------------------------------------------------------

def build_manifest(root: Path) -> list:
    """Return list of (relative_path, content) tuples for all patched files."""
    mobile = root / "mobile" / "app"
    return [
        (mobile / "(owner)" / "_layout.tsx",   OWNER_LAYOUT),
        (mobile / "(worker)" / "_layout.tsx",  WORKER_LAYOUT),
        (mobile / "(owner)" / "dashboard.tsx", OWNER_DASHBOARD),
        (mobile / "(worker)" / "dashboard.tsx",WORKER_DASHBOARD),
        (root / "README.txt",                  README),
    ]


# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------

def preflight(manifest: list) -> bool:
    print()
    info("Running preflight checks …")
    all_ok = True

    for path, _ in manifest[:-1]:          # skip README — it's always new
        if not path.exists():
            err(f"Source file not found: {path}")
            all_ok = False
        else:
            info(f"Found  {path}")

    if not all_ok:
        err("Preflight failed. Are you running from the repository root?")
    return all_ok


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def apply(dry_run: bool = False) -> None:
    root = repo_root()
    info(f"Repository root: {root}")

    manifest = build_manifest(root)

    if not preflight(manifest):
        sys.exit(1)

    print()
    info("Applying patch …")
    for path, content in manifest:
        write_file(path, content, dry_run)

    print()
    if dry_run:
        info("Dry-run complete — no files were modified.")
    else:
        ok("Patch applied successfully.")
        print()
        print(f"  {BOLD}Files written:{RESET}")
        for path, _ in manifest:
            print(f"    {path}")
        print()
        print(f"  {BOLD}Backup files (.bak) created alongside each modified file.{RESET}")
        print(f"  Run  python apply_patch.py --undo  to restore originals.\n")


def undo() -> None:
    root = repo_root()
    manifest = build_manifest(root)
    info("Restoring original files from .bak backups …")
    print()
    any_restored = False
    for path, _ in manifest:
        if restore(path):
            ok(f"Restored {path}")
            any_restored = True
        else:
            info(f"No backup found for {path} — skipped")
    print()
    if any_restored:
        ok("Undo complete.")
    else:
        info("Nothing to undo — no .bak files were found.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply or undo the Laizer native-icons + sign-out patch.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=dedent("""\
            Examples:
              python apply_patch.py               # apply the patch
              python apply_patch.py --dry-run     # preview without writing
              python apply_patch.py --undo        # restore from .bak backups
        """),
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview changes without writing any files.")
    parser.add_argument("--undo", action="store_true",
                        help="Restore original files from .bak backups.")
    args = parser.parse_args()

    print()
    print(f"{BOLD}{'=' * 60}{RESET}")
    print(f"{BOLD}  Laizer Patch: Native Icons + Sign-Out{RESET}")
    print(f"{BOLD}{'=' * 60}{RESET}")

    if args.undo:
        undo()
    else:
        apply(dry_run=args.dry_run)


if __name__ == "__main__":
    main()

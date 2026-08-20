import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { useAppStore } from '@/store/use-app-store';
import { Spacing, Shapes, MaxContentWidth } from '@/constants/theme';
import { M3Card } from '@/components/material/m3-card';
import { M3Button } from '@/components/material/m3-button';
import { M3Badge } from '@/components/material/m3-badge';
import { ConnectionStatus } from '@/components/sync/connection-status';
import { SyncProgressBar } from '@/components/sync/sync-progress-bar';
import { MaterialIcons } from '@expo/vector-icons';

function formatRelativeTime(iso?: string): string {
  if (!iso) return '';
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

export default function SyncScreen() {
  const { colors } = useMaterialTheme();
  const insets = useSafeAreaInsets();

  const {
    ip,
    port,
    setIp,
    setPort,
    serverHistory,
    serverInfo,
    status,
    errorMessage,
    syncProgress,
    lastSyncTime,
    latencyMs,
    stats,
    checkConnection,
    syncDatabase,
    removeHistoryServer,
  } = useAppStore();

  const [inputIp, setInputIp] = useState<string>(ip);
  const [inputPort, setInputPort] = useState<string>(port.toString());
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    setInputIp(ip);
    setInputPort(port.toString());
  }, [ip, port]);

  const handleApplyAndTest = async () => {
    const p = parseInt(inputPort, 10) || 8080;
    setIp(inputIp.trim());
    setPort(p);
    await checkConnection(inputIp.trim(), p);
  };

  const handleSyncPress = async () => {
    const p = parseInt(inputPort, 10) || 8080;
    setIp(inputIp.trim());
    setPort(p);
    const res = await syncDatabase(inputIp.trim(), p);
    if (res.success) {
      Alert.alert(
        'Sync Complete',
        'Local SQLite database successfully updated with fresh media library snapshot!'
      );
    } else {
      Alert.alert('Sync Failed', res.error || 'Could not download database.');
    }
  };

  const handleSelectHistoryServer = async (histIp: string, histPort: number) => {
    setInputIp(histIp);
    setInputPort(histPort.toString());
    setIp(histIp);
    setPort(histPort);
    await checkConnection(histIp, histPort);
  };

  const handleDeleteHistoryServer = async (delIp: string, delPort: number) => {
    await removeHistoryServer(delIp, delPort);
  };

  const faqs = [
    {
      q: 'How do I start the sync server on Linux?',
      a: 'Open the External Drive Media Organizer desktop app, navigate to Settings in the sidebar, scroll to "Local Network Mobile Sync", and toggle the switch to ON.',
    },
    {
      q: 'Cannot connect from mobile device?',
      a: 'Verify both phone and desktop are on the same Wi-Fi network (not guest Wi-Fi). If Linux firewall (ufw) is active, allow the port via: sudo ufw allow 8080/tcp',
    },
    {
      q: 'How does live media streaming work?',
      a: 'The mobile app connects to http://<IP>:8080/media/<id> to stream full-res video with HTTP 206 Range seeking support and http://<IP>:8080/thumbnail/<id> for fast JPEG thumbnails.',
    },
    {
      q: 'How does database snapshot sync work?',
      a: 'The server creates an exFAT-safe SQLite VACUUM INTO snapshot and streams .media_library.db over LAN. The mobile app saves it locally, allowing complete offline search and inspection.',
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: insets.bottom + Spacing.seven },
      ]}
    >
      {/* Live Status Header */}
      <ConnectionStatus
        status={status}
        serverIp={inputIp}
        serverPort={parseInt(inputPort, 10) || 8080}
        driveName={serverInfo?.drive_name}
        latencyMs={latencyMs}
        style={{ marginBottom: Spacing.three }}
      />

      {/* Error Banner */}
      {errorMessage && (
        <M3Card
          variant="filled"
          style={[styles.errorCard, { backgroundColor: colors.errorContainer }]}
        >
          <MaterialIcons name="error-outline" size={22} color={colors.onErrorContainer} />
          <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>
            {errorMessage}
          </Text>
        </M3Card>
      )}

      {/* Sync Progress Bar */}
      {syncProgress && (
        <M3Card variant="outlined" style={{ marginBottom: Spacing.three }}>
          <SyncProgressBar progress={syncProgress} />
        </M3Card>
      )}

      {/* 5 Last Connected Servers Quick Selector */}
      {serverHistory.length > 0 && (
        <View style={styles.historySection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeader, { color: colors.primary }]}>
              SAVED SERVERS (LAST {serverHistory.length} OF 5)
            </Text>
            <Text style={[styles.quickHint, { color: colors.outline }]}>
              Tap to switch
            </Text>
          </View>

          {serverHistory.map((srv, idx) => {
            const isCurrent = srv.ip === inputIp && srv.port === (parseInt(inputPort, 10) || 8080);
            return (
              <Pressable
                key={`${srv.ip}-${srv.port}-${idx}`}
                onPress={() => handleSelectHistoryServer(srv.ip, srv.port)}
                style={({ pressed }) => [
                  styles.historyCard,
                  {
                    backgroundColor: isCurrent
                      ? colors.secondaryContainer
                      : colors.surfaceContainer,
                    borderColor: isCurrent
                      ? colors.secondary
                      : colors.outlineVariant,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View
                  style={[
                    styles.historyIconBox,
                    {
                      backgroundColor: isCurrent
                        ? colors.secondary
                        : colors.surfaceContainerHighest,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={isCurrent ? 'check-circle' : 'router'}
                    size={20}
                    color={isCurrent ? colors.onSecondary : colors.onSurfaceVariant}
                  />
                </View>

                <View style={styles.historyContent}>
                  <View style={styles.historyTopRow}>
                    <Text
                      style={[
                        styles.historyIp,
                        {
                          color: isCurrent
                            ? colors.onSecondaryContainer
                            : colors.onSurface,
                          fontWeight: isCurrent ? '800' : '600',
                        },
                      ]}
                    >
                      {srv.ip}:{srv.port}
                    </Text>
                    {isCurrent && (
                      <M3Badge
                        label="ACTIVE"
                        variant="secondary"
                        size="small"
                        style={{ marginLeft: Spacing.one }}
                      />
                    )}
                  </View>

                  <View style={styles.historyBottomRow}>
                    {srv.driveName ? (
                      <Text style={[styles.driveLabel, { color: colors.primary }]}>
                        Drive: {srv.driveName}
                      </Text>
                    ) : (
                      <Text style={[styles.driveLabel, { color: colors.outline }]}>
                        External Media Organizer
                      </Text>
                    )}
                    {srv.lastConnectedAt && (
                      <Text style={[styles.timeAgo, { color: colors.outline }]}>
                        • {formatRelativeTime(srv.lastConnectedAt)}
                      </Text>
                    )}
                  </View>
                </View>

                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteHistoryServer(srv.ip, srv.port);
                  }}
                  hitSlop={12}
                  style={styles.deleteBtn}
                >
                  <MaterialIcons name="close" size={18} color={colors.outline} />
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Server Configuration Card */}
      <M3Card variant="elevated" style={styles.configCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="dns" size={22} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Connect to Server
          </Text>
        </View>

        <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>
          Desktop Host IP Address
        </Text>
        <View
          style={[
            styles.inputBox,
            {
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <TextInput
            value={inputIp}
            onChangeText={setInputIp}
            placeholder="192.168.1.100"
            placeholderTextColor={colors.outline}
            style={[styles.input, { color: colors.onSurface }]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numeric"
          />
        </View>

        <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant, marginTop: Spacing.two }]}>
          Server Port
        </Text>
        <View
          style={[
            styles.inputBox,
            {
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <TextInput
            value={inputPort}
            onChangeText={setInputPort}
            placeholder="8080"
            placeholderTextColor={colors.outline}
            style={[styles.input, { color: colors.onSurface }]}
            keyboardType="number-pad"
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <M3Button
            label="Test Connection"
            icon="wifi"
            variant="outlined"
            loading={status === 'testing'}
            onPress={handleApplyAndTest}
            style={{ flex: 1, marginRight: Spacing.two }}
          />
          <M3Button
            label={status === 'downloading' ? 'Downloading...' : 'Download DB'}
            icon="cloud-download"
            variant="filled"
            loading={status === 'downloading' || status === 'migrating'}
            onPress={handleSyncPress}
            style={{ flex: 1 }}
          />
        </View>
      </M3Card>

      {/* Local SQLite Database Info */}
      <M3Card variant="filled" style={styles.dbInfoCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="storage" size={22} color={colors.secondary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Local Database State
          </Text>
          <M3Badge
            label={stats.total_items > 0 ? 'ACTIVE' : 'EMPTY'}
            variant={stats.total_items > 0 ? 'primary' : 'surface'}
            size="small"
            style={{ marginLeft: 'auto' }}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.dbStatCol}>
            <Text style={[styles.dbStatLabel, { color: colors.outline }]}>Total Media</Text>
            <Text style={[styles.dbStatVal, { color: colors.onSurface }]}>{stats.total_items}</Text>
          </View>
          <View style={styles.dbStatCol}>
            <Text style={[styles.dbStatLabel, { color: colors.outline }]}>Albums</Text>
            <Text style={[styles.dbStatVal, { color: colors.onSurface }]}>{stats.albums}</Text>
          </View>
          <View style={styles.dbStatCol}>
            <Text style={[styles.dbStatLabel, { color: colors.outline }]}>DB Size</Text>
            <Text style={[styles.dbStatVal, { color: colors.onSurface }]}>{stats.db_size_formatted}</Text>
          </View>
        </View>

        {lastSyncTime && (
          <Text style={[styles.lastSyncLabel, { color: colors.onSurfaceVariant }]}>
            Last Synced: {new Date(lastSyncTime).toLocaleString()}
          </Text>
        )}
      </M3Card>

      {/* Troubleshooting FAQs */}
      <View style={styles.faqSection}>
        <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}>
          TROUBLESHOOTING & HELP
        </Text>
        {faqs.map((faq, index) => {
          const isExpanded = expandedFaq === index;
          return (
            <M3Card
              key={index}
              variant="outlined"
              style={{ marginBottom: Spacing.two }}
              padding="two"
              onPress={() => setExpandedFaq(isExpanded ? null : index)}
            >
              <View style={styles.faqHeader}>
                <Text style={[styles.faqQuestion, { color: colors.onSurface }]}>
                  {faq.q}
                </Text>
                <MaterialIcons
                  name={isExpanded ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={colors.onSurfaceVariant}
                />
              </View>
              {isExpanded && (
                <Text style={[styles.faqAnswer, { color: colors.onSurfaceVariant }]}>
                  {faq.a}
                </Text>
              )}
            </M3Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Shapes.medium,
    marginBottom: Spacing.three,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: Spacing.two,
    flex: 1,
  },
  historySection: {
    marginBottom: Spacing.three,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  quickHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: Shapes.medium,
    borderWidth: 1,
    marginBottom: Spacing.one,
  },
  historyIconBox: {
    width: 38,
    height: 38,
    borderRadius: Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  historyContent: {
    flex: 1,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyIp: {
    fontSize: 14,
  },
  historyBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  driveLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeAgo: {
    fontSize: 11,
    marginLeft: 4,
  },
  deleteBtn: {
    padding: Spacing.one,
    marginLeft: Spacing.one,
  },
  configCard: {
    marginBottom: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: Spacing.one,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.one,
  },
  inputBox: {
    height: 48,
    borderRadius: Shapes.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    height: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: Spacing.four,
  },
  dbInfoCard: {
    marginBottom: Spacing.three,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
  },
  dbStatCol: {
    alignItems: 'center',
  },
  dbStatLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  dbStatVal: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  lastSyncLabel: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  faqSection: {
    marginTop: Spacing.two,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: Spacing.two,
  },
  faqAnswer: {
    fontSize: 12,
    marginTop: Spacing.two,
    lineHeight: 18,
  },
});

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Spacing, Shapes, Elevation } from '@/constants/theme';
import { M3Card } from '@/components/material/m3-card';
import { M3Badge } from '@/components/material/m3-badge';
import { M3Button } from '@/components/material/m3-button';
import {
  scanLocalNetwork,
  DiscoveredServer,
  getDeviceIpAddress,
  getSubnetPrefix,
} from '@/services/lan-discovery';
import { toast } from 'sonner-native';

export interface LanServerScannerProps {
  currentIp: string;
  currentPort: number;
  knownIps: string[];
  isManualOpen: boolean;
  onSelectServer: (server: DiscoveredServer) => void;
  onToggleManual: (showManual: boolean) => void;
}

export const LanServerScanner: React.FC<LanServerScannerProps> = ({
  currentIp,
  currentPort,
  knownIps,
  isManualOpen,
  onSelectServer,
  onToggleManual,
}) => {
  const { colors } = useMaterialTheme();

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([]);
  const [scannedCount, setScannedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(254);
  const [activeSubnet, setActiveSubnet] = useState<string>('');
  const [hasScanned, setHasScanned] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the radar icon while scanning
  useEffect(() => {
    if (isScanning) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isScanning, pulseAnim]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleStartScan = useCallback(async () => {
    if (isScanning) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsScanning(true);
    setHasScanned(true);
    setDiscoveredServers([]);
    setScannedCount(0);

    const deviceIp = await getDeviceIpAddress();
    const guessedSubnet = deviceIp
      ? getSubnetPrefix(deviceIp)
      : getSubnetPrefix(currentIp) || '192.168.1';
    setActiveSubnet(guessedSubnet || '192.168.1');

    try {
      const result = await scanLocalNetwork({
        port: currentPort || 8080,
        preferredSubnet: currentIp,
        knownIps,
        signal: controller.signal,
        onServerFound: (server) => {
          setDiscoveredServers((prev) => {
            if (prev.some((s) => s.ip === server.ip && s.port === server.port)) {
              return prev;
            }
            return [...prev, server];
          });
          toast.success(`Discovered ${server.serverName} at ${server.ip}!`);
        },
        onProgress: (scanned, total) => {
          setScannedCount(scanned);
          setTotalCount(total);
        },
      });

      setActiveSubnet(result.scannedSubnet);

      if (!controller.signal.aborted) {
        if (result.servers.length === 0) {
          toast.info('No servers discovered on local subnet. You can input IP manually.');
          onToggleManual(true);
        } else {
          toast.success(`Found ${result.servers.length} server(s) on ${result.scannedSubnet}.*`);
        }
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        toast.error('Network scan encountered an error.');
      }
    } finally {
      setIsScanning(false);
      abortControllerRef.current = null;
    }
  }, [isScanning, currentPort, currentIp, knownIps, onToggleManual]);

  const handleStopScan = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsScanning(false);
    toast.info('Network scan cancelled.');
  }, []);

  const progressPct = totalCount > 0 ? Math.min(100, Math.round((scannedCount / totalCount) * 100)) : 0;

  return (
    <M3Card variant="elevated" style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View
              style={[
                styles.radarIconBox,
                {
                  backgroundColor: isScanning
                    ? colors.primary
                    : colors.primaryContainer,
                },
              ]}
            >
              <MaterialIcons
                name="wifi-find"
                size={22}
                color={isScanning ? colors.onPrimary : colors.primary}
              />
            </View>
          </Animated.View>
          <View style={styles.headerTextCol}>
            <Text style={[styles.title, { color: colors.onSurface }]}>
              LAN Server Discovery
            </Text>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
              {isScanning
                ? `Scanning ${activeSubnet}.* on port ${currentPort || 8080}...`
                : hasScanned && discoveredServers.length > 0
                ? `${discoveredServers.length} server(s) available on local network`
                : 'Auto-detect desktop sync servers on your Wi-Fi'}
            </Text>
          </View>
        </View>

        {isScanning ? (
          <M3Button
            label="Stop"
            icon="stop"
            variant="tonal"
            size="small"
            onPress={handleStopScan}
          />
        ) : (
          <M3Button
            label={hasScanned ? 'Rescan' : 'Scan LAN'}
            icon="radar"
            variant="filled"
            size="small"
            onPress={handleStartScan}
          />
        )}
      </View>

      {/* Live Scanning Progress Bar */}
      {isScanning && (
        <View style={styles.progressContainer}>
          <View style={styles.progressMetaRow}>
            <Text style={[styles.progressText, { color: colors.primary }]}>
              Scanning subnet ({scannedCount} of {totalCount} IPs)
            </Text>
            <Text style={[styles.progressPctText, { color: colors.primary }]}>
              {progressPct}%
            </Text>
          </View>
          <View
            style={[
              styles.progressBarTrack,
              { backgroundColor: colors.surfaceContainerHighest },
            ]}
          >
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: colors.primary,
                  width: `${Math.max(4, progressPct)}%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Discovered Servers List */}
      {discoveredServers.length > 0 && (
        <View style={styles.serverListSection}>
          <View style={styles.serverListHeader}>
            <Text style={[styles.serverListLabel, { color: colors.primary }]}>
              AVAILABLE SERVERS ({discoveredServers.length})
            </Text>
            <Text style={[styles.serverListHint, { color: colors.outline }]}>
              Tap to select & connect
            </Text>
          </View>

          {discoveredServers.map((server) => {
            const isSelected =
              server.ip === currentIp && server.port === currentPort;

            return (
              <Pressable
                key={`${server.ip}:${server.port}`}
                onPress={() => onSelectServer(server)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                style={({ pressed }) => [
                  styles.serverCard,
                  {
                    backgroundColor: isSelected
                      ? colors.secondaryContainer
                      : colors.surfaceContainer,
                    borderColor: isSelected
                      ? colors.secondary
                      : colors.outlineVariant,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.serverIconBox,
                    {
                      backgroundColor: isSelected
                        ? colors.secondary
                        : colors.primaryContainer,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="dns"
                    size={22}
                    color={
                      isSelected
                        ? colors.onSecondary
                        : colors.onPrimaryContainer
                    }
                  />
                </View>

                <View style={styles.serverDetailsCol}>
                  <View style={styles.serverTopLine}>
                    <Text
                      style={[
                        styles.serverName,
                        {
                          color: isSelected
                            ? colors.onSecondaryContainer
                            : colors.onSurface,
                          fontWeight: '800',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {server.serverName}
                    </Text>
                    {isSelected && (
                      <M3Badge
                        label="ACTIVE"
                        variant="primary"
                        size="small"
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </View>

                  <View style={styles.serverMetaLine}>
                    <Text
                      style={[
                        styles.serverAddress,
                        {
                          color: isSelected
                            ? colors.onSecondaryContainer
                            : colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {server.ip}:{server.port}
                    </Text>

                    {server.driveName && (
                      <View style={styles.driveBadgePill}>
                        <MaterialIcons
                          name="folder-special"
                          size={12}
                          color={colors.primary}
                          style={{ marginRight: 3 }}
                        />
                        <Text
                          style={[
                            styles.driveBadgeText,
                            { color: colors.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {server.driveName}
                        </Text>
                      </View>
                    )}

                    <View style={styles.latencyPill}>
                      <MaterialIcons
                        name="speed"
                        size={12}
                        color={colors.outline}
                        style={{ marginRight: 2 }}
                      />
                      <Text
                        style={[
                          styles.latencyText,
                          { color: colors.outline },
                        ]}
                      >
                        {server.latencyMs}ms
                      </Text>
                    </View>
                  </View>
                </View>

                <MaterialIcons
                  name={isSelected ? 'check-circle' : 'chevron-right'}
                  size={22}
                  color={
                    isSelected ? colors.secondary : colors.outline
                  }
                  style={{ marginLeft: 8 }}
                />
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Empty State: Finished scanning but none found */}
      {hasScanned && !isScanning && discoveredServers.length === 0 && (
        <View
          style={[
            styles.emptyStateBox,
            { backgroundColor: colors.surfaceContainerLow },
          ]}
        >
          <MaterialIcons
            name="portable-wifi-off"
            size={36}
            color={colors.outline}
          />
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
            No Servers Discovered on {activeSubnet}.*
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              { color: colors.onSurfaceVariant },
            ]}
          >
            Ensure your desktop sync server is actively running on port{' '}
            {currentPort || 8080} and that this phone is connected to the same
            Wi-Fi network.
          </Text>
          <M3Button
            label="Enter IP Manually"
            icon="edit"
            variant="tonal"
            size="small"
            onPress={() => onToggleManual(true)}
            style={{ marginTop: Spacing.two }}
          />
        </View>
      )}

      {/* Manual Input Toggle Footer */}
      <View style={styles.footerRow}>
        <Pressable
          onPress={() => onToggleManual(!isManualOpen)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.manualToggleBtn}
        >
          <MaterialIcons
            name={isManualOpen ? 'keyboard-arrow-up' : 'edit'}
            size={16}
            color={colors.primary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.manualToggleText, { color: colors.primary }]}>
            {isManualOpen ? 'Hide Manual IP Entry' : 'Enter IP Manually'}
          </Text>
        </Pressable>
      </View>
    </M3Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.two,
  },
  radarIconBox: {
    width: 44,
    height: 44,
    borderRadius: Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  progressContainer: {
    marginTop: Spacing.three,
  },
  progressMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressPctText: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: Shapes.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: Shapes.full,
  },
  serverListSection: {
    marginTop: Spacing.three,
  },
  serverListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  serverListLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  serverListHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  serverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Shapes.medium,
    borderWidth: 1,
    marginBottom: Spacing.two,
  },
  serverIconBox: {
    width: 38,
    height: 38,
    borderRadius: Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.two,
  },
  serverDetailsCol: {
    flex: 1,
  },
  serverTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverName: {
    fontSize: 14,
    flex: 1,
  },
  serverMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  serverAddress: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  driveBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Shapes.full,
    backgroundColor: 'rgba(100,100,100,0.1)',
  },
  driveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 120,
  },
  latencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  latencyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    borderRadius: Shapes.medium,
    marginTop: Spacing.three,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.two,
    paddingTop: Spacing.one,
  },
  manualToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  manualToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

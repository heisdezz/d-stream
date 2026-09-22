import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSetAtom } from "jotai";
import { pageSizeAtom } from "@/store/atoms";
import {
  useMaterialTheme,
  THEME_ACCENT_PRESETS,
} from "@/hooks/use-material-theme";
import { useAppStore } from "@/store/use-app-store";
import { Spacing, Shapes, MaxContentWidth } from "@/constants/theme";
import {
  PAGE_SIZE_OPTIONS,
  DEFAULT_DOWNLOAD_LOCATION,
} from "@/services/storage";
import { M3Card } from "@/components/material/m3-card";
import { M3Button } from "@/components/material/m3-button";
import { M3Badge } from "@/components/material/m3-badge";
import { ConnectionStatus } from "@/components/sync/connection-status";
import { SyncProgressBar } from "@/components/sync/sync-progress-bar";
import { LanServerScanner } from "@/components/sync/lan-server-scanner";
import { DiscoveredServer } from "@/services/lan-discovery";
import { MaterialIcons } from "@expo/vector-icons";
import { toast } from "sonner-native";

function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 2) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

export default function SyncScreen() {
  const {
    colors,
    themeAccent,
    themeMode,
    isDynamicSupported,
    setThemeAccent,
    setThemeMode,
  } = useMaterialTheme();
  const insets = useSafeAreaInsets();
  const setPageSizeAtom = useSetAtom(pageSizeAtom);

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
    pageSize,
    downloadLocation,
    checkConnection,
    syncDatabase,
    updatePageSize,
    updateDownloadLocation,
    removeHistoryServer,
    playAsShorts,
    setPlayAsShorts,
  } = useAppStore();

  const [inputIp, setInputIp] = useState<string>(ip);
  const [inputPort, setInputPort] = useState<string>(port.toString());
  const [inputDlLocation, setInputDlLocation] =
    useState<string>(downloadLocation);
  const [showManualConfig, setShowManualConfig] = useState<boolean>(
    !serverHistory.length,
  );

  useEffect(() => {
    setInputIp(ip);
    setInputPort(port.toString());
  }, [ip, port]);

  useEffect(() => {
    setInputDlLocation(downloadLocation);
  }, [downloadLocation]);

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
      toast.success("Database synced successfully!");
    } else {
      Alert.alert("Sync Failed", res.error || "Could not download database.");
    }
  };

  const handleSelectDiscoveredServer = async (server: DiscoveredServer) => {
    setInputIp(server.ip);
    setInputPort(server.port.toString());
    setIp(server.ip);
    setPort(server.port);
    toast.info(`Connecting to ${server.serverName}...`);
    await checkConnection(server.ip, server.port);
  };

  const handleSaveDownloadLocation = async () => {
    const loc = inputDlLocation.trim() || DEFAULT_DOWNLOAD_LOCATION;
    await updateDownloadLocation(loc);
    toast.success(`Download location saved to ${loc}`);
  };

  const handleResetDownloadLocation = async () => {
    setInputDlLocation(DEFAULT_DOWNLOAD_LOCATION);
    await updateDownloadLocation(DEFAULT_DOWNLOAD_LOCATION);
    toast.info(`Reset to default: ${DEFAULT_DOWNLOAD_LOCATION}`);
  };

  const handleSelectHistoryServer = async (
    histIp: string,
    histPort: number,
  ) => {
    setInputIp(histIp);
    setInputPort(histPort.toString());
    setIp(histIp);
    setPort(histPort);
    await checkConnection(histIp, histPort);
  };

  const handleDeleteHistoryServer = async (delIp: string, delPort: number) => {
    await removeHistoryServer(delIp, delPort);
  };

  const handleSelectPageSize = async (size: number) => {
    setPageSizeAtom(size);
    await updatePageSize(size);
  };

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
          <MaterialIcons
            name="error-outline"
            size={20}
            color={colors.onErrorContainer}
          />
          <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>
            {errorMessage}
          </Text>
        </M3Card>
      )}

      {/* Sync Progress */}
      {syncProgress && (
        <M3Card variant="outlined" style={{ marginBottom: Spacing.three }}>
          <SyncProgressBar progress={syncProgress} />
        </M3Card>
      )}

      {/* LAN Server Discovery Scanner */}
      <LanServerScanner
        currentIp={inputIp}
        currentPort={parseInt(inputPort, 10) || 8080}
        knownIps={serverHistory.map((s) => s.ip)}
        isManualOpen={showManualConfig}
        onSelectServer={handleSelectDiscoveredServer}
        onToggleManual={(open) => setShowManualConfig(open)}
      />

      {/* Saved Servers List */}
      {serverHistory.length > 0 && (
        <View style={styles.historySection}>
          <Text style={[styles.sectionHeader, { color: colors.primary }]}>
            SAVED SERVERS
          </Text>

          {serverHistory.map((srv, idx) => {
            const isCurrent =
              srv.ip === inputIp &&
              srv.port === (parseInt(inputPort, 10) || 8080);
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
                        : colors.primaryContainer,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="dns"
                    size={20}
                    color={
                      isCurrent ? colors.onSecondary : colors.onPrimaryContainer
                    }
                  />
                </View>

                <View style={styles.historyInfo}>
                  <View style={styles.historyTopRow}>
                    <Text
                      style={[
                        styles.historyAddress,
                        {
                          color: isCurrent
                            ? colors.onSecondaryContainer
                            : colors.onSurface,
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
                  <Text style={[styles.historyMeta, { color: colors.outline }]}>
                    {srv.driveName ? `${srv.driveName} • ` : ""}
                    {formatRelativeTime(srv.lastConnectedAt)}
                  </Text>
                </View>

                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteHistoryServer(srv.ip, srv.port);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.deleteBtn}
                >
                  <MaterialIcons
                    name="close"
                    size={18}
                    color={colors.outline}
                  />
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Manual Connection Card (Collapsible) */}
      {showManualConfig && (
        <M3Card variant="elevated" style={styles.configCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="tune" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
              Manual Connection
            </Text>
          </View>

          <View style={styles.formRow}>
            <View style={{ flex: 3, marginRight: Spacing.two }}>
              <Text
                style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}
              >
                IP Address
              </Text>
              <TextInput
                value={inputIp}
                onChangeText={setInputIp}
                placeholder="192.168.1.100"
                placeholderTextColor={colors.outline}
                keyboardType="numeric"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceContainerHighest,
                    borderColor: colors.outlineVariant,
                    color: colors.onSurface,
                  },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={{ flex: 1.5 }}>
              <Text
                style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}
              >
                Port
              </Text>
              <TextInput
                value={inputPort}
                onChangeText={setInputPort}
                placeholder="8080"
                placeholderTextColor={colors.outline}
                keyboardType="numeric"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceContainerHighest,
                    borderColor: colors.outlineVariant,
                    color: colors.onSurface,
                  },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.buttonRow}>
            <M3Button
              label={status === "testing" ? "Testing..." : "Test Connection"}
              icon="wifi-find"
              variant="outlined"
              loading={status === "testing"}
              onPress={handleApplyAndTest}
              style={{ flex: 1, marginRight: Spacing.two }}
            />
            <M3Button
              label={status === "downloading" ? "Syncing..." : "Sync DB"}
              icon="sync"
              variant="filled"
              loading={status === "downloading" || status === "migrating"}
              onPress={handleSyncPress}
              style={{ flex: 1 }}
            />
          </View>
        </M3Card>
      )}

      {/* Appearance & Color Scheme Card */}
      <M3Card variant="elevated" style={styles.prefCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="palette" size={20} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Theme & Appearance
          </Text>
        </View>

        {/* Theme Mode Switcher */}
        <View
          style={[
            styles.themeModeRow,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          {(
            [
              { mode: "system", label: "System", icon: "brightness-auto" },
              { mode: "light", label: "Light", icon: "light-mode" },
              { mode: "dark", label: "Dark", icon: "dark-mode" },
            ] as const
          ).map((item) => {
            const isSelected = themeMode === item.mode;
            return (
              <Pressable
                key={item.mode}
                onPress={() => setThemeMode(item.mode)}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                style={({ pressed }) => [
                  styles.themeModeBtn,
                  {
                    backgroundColor: isSelected
                      ? colors.secondaryContainer
                      : "transparent",
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <MaterialIcons
                  name={item.icon}
                  size={16}
                  color={
                    isSelected
                      ? colors.onSecondaryContainer
                      : colors.onSurfaceVariant
                  }
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.themeModeText,
                    {
                      color: isSelected
                        ? colors.onSecondaryContainer
                        : colors.onSurfaceVariant,
                      fontWeight: isSelected ? "700" : "500",
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Accent Color Presets */}
        <View style={styles.presetGrid}>
          {THEME_ACCENT_PRESETS.map((preset) => {
            const isSelected = themeAccent === preset.id;
            return (
              <Pressable
                key={preset.id}
                onPress={() => setThemeAccent(preset.id)}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                style={({ pressed }) => [
                  styles.presetChip,
                  {
                    backgroundColor: isSelected
                      ? colors.secondaryContainer
                      : colors.surfaceContainer,
                    borderColor: isSelected
                      ? colors.secondary
                      : colors.outlineVariant,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View
                  style={[
                    styles.colorDot,
                    {
                      backgroundColor:
                        preset.id === "system" ? colors.primary : preset.color,
                    },
                  ]}
                >
                  {preset.id === "system" && (
                    <MaterialIcons
                      name="wallpaper"
                      size={10}
                      color={colors.onPrimary}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.presetLabel,
                    {
                      color: isSelected
                        ? colors.onSecondaryContainer
                        : colors.onSurface,
                      fontWeight: isSelected ? "700" : "500",
                    },
                  ]}
                >
                  {preset.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </M3Card>

      {/* Play as Shorts / Reels Card */}
      <M3Card variant="elevated" style={styles.prefCard}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, marginRight: Spacing.two }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MaterialIcons
                name="movie-filter"
                size={20}
                color={colors.primary}
                style={{ marginRight: Spacing.one }}
              />
              <Text style={[styles.switchTitle, { color: colors.onSurface }]}>
                Play as Shorts / Reels
              </Text>
            </View>
            <Text
              style={[
                styles.prefDesc,
                { color: colors.onSurfaceVariant, marginTop: 4 },
              ]}
            >
              Full-screen vertical reels player with swipe-to-next.
            </Text>
          </View>
          <Switch
            value={playAsShorts}
            onValueChange={setPlayAsShorts}
            trackColor={{
              false: colors.surfaceContainerHighest,
              true: colors.primary,
            }}
            thumbColor={playAsShorts ? colors.onPrimary : colors.outline}
          />
        </View>
      </M3Card>

      {/* Download Storage Location Card */}
      <M3Card variant="elevated" style={styles.prefCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="folder" size={20} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Download Directory
          </Text>
        </View>

        <TextInput
          value={inputDlLocation}
          onChangeText={setInputDlLocation}
          placeholder="d-stream-downloads"
          placeholderTextColor={colors.outline}
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outlineVariant,
              color: colors.onSurface,
              marginBottom: Spacing.two,
            },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.buttonRow}>
          <M3Button
            label="Save"
            icon="check"
            variant="filled"
            onPress={handleSaveDownloadLocation}
            style={{ flex: 1, marginRight: Spacing.two }}
          />
          <M3Button
            label="Reset Default"
            icon="restore"
            variant="outlined"
            onPress={handleResetDownloadLocation}
          />
        </View>
      </M3Card>

      {/* Gallery Page Size Card */}
      <M3Card variant="elevated" style={styles.prefCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="view-module" size={20} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Items per Page
          </Text>
        </View>

        <View style={styles.pageSizeRow}>
          {PAGE_SIZE_OPTIONS.map((size) => {
            const isSelected = (pageSize || 96) === size;
            return (
              <Pressable
                key={size}
                onPress={() => handleSelectPageSize(size)}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                style={({ pressed }) => [
                  styles.prefSizePill,
                  {
                    backgroundColor: isSelected
                      ? colors.secondaryContainer
                      : colors.surfaceContainer,
                    borderColor: isSelected
                      ? colors.secondary
                      : colors.outlineVariant,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={[
                    styles.prefSizeText,
                    {
                      color: isSelected
                        ? colors.onSecondaryContainer
                        : colors.onSurface,
                      fontWeight: isSelected ? "800" : "600",
                    },
                  ]}
                >
                  {size}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </M3Card>

      {/* Local SQLite Database Snapshot Card */}
      <M3Card variant="elevated" style={styles.dbInfoCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="storage" size={20} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Local Database
          </Text>
          {lastSyncTime && (
            <Text style={[styles.lastSyncHint, { color: colors.outline }]}>
              {formatRelativeTime(lastSyncTime)}
            </Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.dbStatCol}>
            <Text style={[styles.dbStatVal, { color: colors.primary }]}>
              {stats.total_items.toLocaleString()}
            </Text>
            <Text
              style={[styles.dbStatLabel, { color: colors.onSurfaceVariant }]}
            >
              Items
            </Text>
          </View>

          <View style={styles.dbStatCol}>
            <Text style={[styles.dbStatVal, { color: colors.primary }]}>
              {stats.albums.toLocaleString()}
            </Text>
            <Text
              style={[styles.dbStatLabel, { color: colors.onSurfaceVariant }]}
            >
              Albums
            </Text>
          </View>

          <View style={styles.dbStatCol}>
            <Text style={[styles.dbStatVal, { color: colors.primary }]}>
              {stats.tags.toLocaleString()}
            </Text>
            <Text
              style={[styles.dbStatLabel, { color: colors.onSurfaceVariant }]}
            >
              Tags
            </Text>
          </View>

          <View style={styles.dbStatCol}>
            <Text style={[styles.dbStatVal, { color: colors.primary }]}>
              {stats.db_size_formatted || "0 B"}
            </Text>
            <Text
              style={[styles.dbStatLabel, { color: colors.onSurfaceVariant }]}
            >
              Size
            </Text>
          </View>
        </View>
      </M3Card>
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
    alignSelf: "center",
    width: "100%",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.three,
    borderRadius: Shapes.medium,
    marginBottom: Spacing.three,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: Spacing.two,
    flex: 1,
  },
  historySection: {
    marginBottom: Spacing.three,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: Spacing.two,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.two + 2,
    borderRadius: Shapes.medium,
    borderWidth: 1,
    marginBottom: Spacing.one + 2,
  },
  historyIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.two,
  },
  historyInfo: {
    flex: 1,
  },
  historyTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyAddress: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  historyMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    padding: Spacing.one,
    marginLeft: Spacing.one,
  },
  configCard: {
    marginBottom: Spacing.three,
    padding: Spacing.three + 2,
  },
  prefCard: {
    marginBottom: Spacing.three,
    padding: Spacing.three + 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.two,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginLeft: Spacing.two,
  },
  lastSyncHint: {
    marginLeft: "auto",
    fontSize: 12,
  },
  formRow: {
    flexDirection: "row",
    marginBottom: Spacing.three,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: Shapes.medium,
    borderWidth: 1,
    paddingHorizontal: Spacing.two + 2,
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: "row",
  },
  themeModeRow: {
    flexDirection: "row",
    borderRadius: Shapes.medium,
    borderWidth: 1,
    padding: 3,
    marginBottom: Spacing.two,
  },
  themeModeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: Shapes.small,
  },
  themeModeText: {
    fontSize: 13,
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one + 2,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Shapes.full,
    borderWidth: 1,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  presetLabel: {
    fontSize: 12,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  prefDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  pageSizeRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  prefSizePill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: Shapes.medium,
    borderWidth: 1,
  },
  prefSizeText: {
    fontSize: 14,
  },
  dbInfoCard: {
    marginBottom: Spacing.three,
    padding: Spacing.three + 2,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.one,
  },
  dbStatCol: {
    alignItems: "center",
    flex: 1,
  },
  dbStatVal: {
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  dbStatLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
});

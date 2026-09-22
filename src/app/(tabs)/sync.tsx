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
  ThemeMode,
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
    isDark,
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
    downloadedItems,
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
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [showManualConfig, setShowManualConfig] = useState<boolean>(
    !serverHistory.length
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
      Alert.alert(
        "Sync Complete",
        "Local SQLite database successfully updated with fresh media library snapshot!",
      );
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
    Alert.alert("Storage Path Saved", `Download location updated to: ${loc}`);
  };

  const handleResetDownloadLocation = async () => {
    setInputDlLocation(DEFAULT_DOWNLOAD_LOCATION);
    await updateDownloadLocation(DEFAULT_DOWNLOAD_LOCATION);
    Alert.alert(
      "Reset to Default",
      `Download location reset to: ${DEFAULT_DOWNLOAD_LOCATION}`,
    );
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

  const downloadedCount = Object.keys(downloadedItems).length;

  const faqs = [
    {
      q: "How do I start the sync server on Linux?",
      a: "From your desktop terminal, navigate to the media project directory and run: cargo run --release or bun run server. The server binds to 0.0.0.0:8080 and streams SQLite snapshots.",
    },
    {
      q: "Why can't my phone reach the desktop server?",
      a: "Verify both phone and desktop are on the same Wi-Fi network (not guest Wi-Fi). If Linux firewall (ufw) is active, allow the port via: sudo ufw allow 8080/tcp",
    },
    {
      q: "How does offline playback work?",
      a: "When you tap the download button on any media item or album, full-quality video/photos are copied to internal device storage. You can play them anytime even when offline.",
    },
    {
      q: "Where is the SQLite database stored on device?",
      a: "The SQLite database snapshot is safely managed by expo-sqlite in the app's sandboxed document directory (SQLite/media_library.db).",
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
          <MaterialIcons
            name="error-outline"
            size={22}
            color={colors.onErrorContainer}
          />
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

      {/* Automatic LAN Server Discovery */}
      <LanServerScanner
        currentIp={inputIp}
        currentPort={parseInt(inputPort, 10) || 8080}
        knownIps={serverHistory.map((s) => s.ip)}
        isManualOpen={showManualConfig}
        onSelectServer={handleSelectDiscoveredServer}
        onToggleManual={(open) => setShowManualConfig(open)}
      />

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
                      isCurrent
                        ? colors.onSecondary
                        : colors.onPrimaryContainer
                    }
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
                          fontWeight: isCurrent ? "800" : "600",
                        },
                      ]}
                    >
                      {srv.ip}:{srv.port}
                    </Text>
                    {isCurrent && (
                      <M3Badge
                        label="ACTIVE"
                        variant="primary"
                        size="small"
                        style={{ marginLeft: "auto" }}
                      />
                    )}
                  </View>
                  <View style={styles.historyBottomRow}>
                    {srv.driveName ? (
                      <Text
                        style={[styles.driveLabel, { color: colors.primary }]}
                      >
                        Drive: {srv.driveName}
                      </Text>
                    ) : (
                      <Text
                        style={[styles.driveLabel, { color: colors.outline }]}
                      >
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

      {/* Server Configuration Card (Manual IP & Port) */}
      {showManualConfig ? (
        <M3Card variant="elevated" style={styles.configCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="settings-ethernet" size={22} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
              Manual Server Configuration
            </Text>
            <M3Badge
              label="MANUAL"
              variant="secondary"
              size="small"
              style={{ marginLeft: "auto" }}
            />
          </View>

          <Text
            style={[
              styles.prefDesc,
              { color: colors.onSurfaceVariant, marginBottom: Spacing.two },
            ]}
          >
            Use manual configuration if your server is on a different subnet, VPN, or if LAN discovery was unable to locate it.
          </Text>

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

          <Text
            style={[
              styles.inputLabel,
              { color: colors.onSurfaceVariant, marginTop: Spacing.two },
            ]}
          >
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
              loading={status === "testing"}
              onPress={handleApplyAndTest}
              style={{ flex: 1, marginRight: Spacing.two }}
            />
            <M3Button
              label={status === "downloading" ? "Downloading..." : "Download DB"}
              icon="cloud-download"
              variant="filled"
              loading={status === "downloading" || status === "migrating"}
              onPress={handleSyncPress}
              style={{ flex: 1 }}
            />
          </View>
        </M3Card>
      ) : (
        <M3Card variant="elevated" style={styles.configCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="dns" size={22} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
              Current Target Server
            </Text>
            <Pressable
              onPress={() => setShowManualConfig(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center" }}
            >
              <MaterialIcons name="edit" size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                Edit IP
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.targetAddressText, { color: colors.onSurface }]}>
            {inputIp}:{inputPort}
          </Text>

          <View style={styles.buttonRow}>
            <M3Button
              label="Test Connection"
              icon="wifi"
              variant="outlined"
              loading={status === "testing"}
              onPress={handleApplyAndTest}
              style={{ flex: 1, marginRight: Spacing.two }}
            />
            <M3Button
              label={status === "downloading" ? "Downloading..." : "Download DB"}
              icon="cloud-download"
              variant="filled"
              loading={status === "downloading" || status === "migrating"}
              onPress={handleSyncPress}
              style={{ flex: 1 }}
            />
          </View>
        </M3Card>
      )}

      {/* Dynamic Material Theme & Color Customizer Card */}
      <M3Card variant="elevated" style={styles.configCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="palette" size={22} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Dynamic Material 3 Color
          </Text>
          <M3Badge
            label={
              themeAccent === "system"
                ? isDynamicSupported
                  ? "EXPO UI MATERIAL YOU"
                  : "EXPO UI DYNAMIC"
                : "CUSTOM SEED"
            }
            variant="primary"
            size="small"
            style={{ marginLeft: "auto" }}
          />
        </View>

        <Text
          style={[
            styles.prefDesc,
            { color: colors.onSurfaceVariant, marginBottom: Spacing.three },
          ]}
        >
          Powered by Expo UI dynamic Material 3 engine. Experience authentic
          tonal elevations, wallpaper palette extraction on Android 12+, and
          tonal palette generation.
        </Text>

        {/* Theme Mode Selector (System, Light, Dark) */}
        <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>
          Appearance Mode
        </Text>
        <View
          style={[
            styles.themeModeRow,
            {
              backgroundColor: colors.surfaceContainer,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          {(
            [
              { mode: "system", label: "Auto", icon: "brightness-auto" },
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
                    borderColor: isSelected
                      ? colors.secondary
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
                      fontWeight: isSelected ? "800" : "500",
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
        <Text
          style={[
            styles.inputLabel,
            { color: colors.onSurfaceVariant, marginTop: Spacing.two },
          ]}
        >
          Dynamic Palette Seed
        </Text>
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
                        preset.id === "system"
                          ? colors.primary
                          : preset.color,
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
                      fontWeight: isSelected ? "800" : "600",
                    },
                  ]}
                >
                  {preset.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Live M3 Color Palette Swatches */}
        <View
          style={[
            styles.tonalPreviewBox,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Text style={[styles.previewTitle, { color: colors.onSurfaceVariant }]}>
            ACTIVE TONAL SCHEME PREVIEW
          </Text>
          <View style={styles.swatchRow}>
            <View
              style={[
                styles.swatchItem,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={[styles.swatchText, { color: colors.onPrimary }]}>
                Primary
              </Text>
            </View>
            <View
              style={[
                styles.swatchItem,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Text
                style={[
                  styles.swatchText,
                  { color: colors.onPrimaryContainer },
                ]}
              >
                Container
              </Text>
            </View>
            <View
              style={[
                styles.swatchItem,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Text style={[styles.swatchText, { color: colors.onSecondary }]}>
                Secondary
              </Text>
            </View>
            <View
              style={[
                styles.swatchItem,
                { backgroundColor: colors.tertiary },
              ]}
            >
              <Text style={[styles.swatchText, { color: colors.onTertiary }]}>
                Tertiary
              </Text>
            </View>
          </View>
        </View>
      </M3Card>

      {/* Play as Shorts / Reels Preference Card */}
      <M3Card variant="elevated" style={styles.prefCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="movie-filter" size={22} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Play as Shorts / Reels
          </Text>
          <M3Badge
            label={playAsShorts ? "SHORTS ENABLED" : "STANDARD"}
            variant={playAsShorts ? "primary" : "surface"}
            size="small"
            style={{ marginLeft: "auto" }}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1, marginRight: Spacing.two }}>
            <Text style={[styles.switchTitle, { color: colors.onSurface }]}>
              TikTok & Reels Vertical Player
            </Text>
            <Text
              style={[
                styles.prefDesc,
                { color: colors.onSurfaceVariant, marginTop: Spacing.one / 2 },
              ]}
            >
              When tapping media or albums, stream directly in full-screen vertical
              reels with swipe-to-next, auto-looping playback, and album-isolated navigation.
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

      {/* Media Download Storage Directory Card */}
      <M3Card variant="elevated" style={styles.prefCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="folder-special" size={22} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Media Storage Folder
          </Text>
          <M3Badge
            label={`${downloadedCount} DOWNLOADED`}
            variant="secondary"
            size="small"
            style={{ marginLeft: "auto" }}
          />
        </View>

        <Text
          style={[
            styles.prefDesc,
            { color: colors.onSurfaceVariant, marginBottom: Spacing.two },
          ]}
        >
          Folder name where full-resolution media files and offline albums are
          saved in your device Documents storage.
        </Text>

        <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>
          Relative Folder Name
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
            value={inputDlLocation}
            onChangeText={setInputDlLocation}
            placeholder={DEFAULT_DOWNLOAD_LOCATION}
            placeholderTextColor={colors.outline}
            style={[styles.input, { color: colors.onSurface }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.buttonRow}>
          <M3Button
            label="Save Folder"
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

      {/* Media Gallery Page Size Preference Card */}
      <M3Card variant="elevated" style={styles.prefCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="view-module" size={22} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Gallery Page Size
          </Text>
          <Text style={[styles.quickHint, { color: colors.outline }]}>
            LegendList Virtualization
          </Text>
        </View>

        <Text style={[styles.prefDesc, { color: colors.onSurfaceVariant }]}>
          Select how many items are loaded per page for infinite scroll and
          memory efficiency.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pageSizePillsContainer}
          style={{ marginTop: Spacing.two }}
        >
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
                  {size} items
                </Text>
                {size === 96 && (
                  <Text
                    style={[styles.defaultTag, { color: colors.outline }]}
                  >
                    Recommended
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </M3Card>

      {/* Local SQLite Database Inspector Card */}
      <M3Card variant="elevated" style={styles.dbInfoCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="storage" size={22} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Local SQLite Snapshot
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.dbStatCol}>
            <Text
              style={[styles.dbStatLabel, { color: colors.onSurfaceVariant }]}
            >
              MEDIA ITEMS
            </Text>
            <Text style={[styles.dbStatVal, { color: colors.primary }]}>
              {stats.total_items.toLocaleString()}
            </Text>
          </View>

          <View style={styles.dbStatCol}>
            <Text
              style={[styles.dbStatLabel, { color: colors.onSurfaceVariant }]}
            >
              ALBUMS
            </Text>
            <Text style={[styles.dbStatVal, { color: colors.primary }]}>
              {stats.albums.toLocaleString()}
            </Text>
          </View>

          <View style={styles.dbStatCol}>
            <Text
              style={[styles.dbStatLabel, { color: colors.onSurfaceVariant }]}
            >
              TAGS
            </Text>
            <Text style={[styles.dbStatVal, { color: colors.primary }]}>
              {stats.tags.toLocaleString()}
            </Text>
          </View>

          <View style={styles.dbStatCol}>
            <Text
              style={[styles.dbStatLabel, { color: colors.onSurfaceVariant }]}
            >
              DB SIZE
            </Text>
            <Text style={[styles.dbStatVal, { color: colors.primary }]}>
              {stats.db_size_formatted || "0 B"}
            </Text>
          </View>
        </View>

        {lastSyncTime && (
          <Text style={[styles.lastSyncLabel, { color: colors.outline }]}>
            Last Snapshot: {new Date(lastSyncTime).toLocaleString()}
          </Text>
        )}
      </M3Card>

      {/* Frequently Asked Questions */}
      <View style={styles.faqSection}>
        <Text
          style={[
            styles.sectionHeader,
            { color: colors.primary, marginBottom: Spacing.two },
          ]}
        >
          FREQUENTLY ASKED QUESTIONS
        </Text>

        {faqs.map((faq, index) => {
          const isExpanded = expandedFaq === index;
          return (
            <M3Card
              key={index}
              variant="outlined"
              onPress={() => setExpandedFaq(isExpanded ? null : index)}
              style={{ marginBottom: Spacing.two }}
            >
              <View style={styles.faqHeader}>
                <Text style={[styles.faqQuestion, { color: colors.onSurface }]}>
                  {faq.q}
                </Text>
                <MaterialIcons
                  name={isExpanded ? "expand-less" : "expand-more"}
                  size={22}
                  color={colors.onSurfaceVariant}
                />
              </View>
              {isExpanded && (
                <Text
                  style={[styles.faqAnswer, { color: colors.onSurfaceVariant }]}
                >
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.one,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  quickHint: {
    fontSize: 11,
    fontWeight: "500",
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.two,
    borderRadius: Shapes.medium,
    borderWidth: 1,
    marginBottom: Spacing.one,
  },
  historyIconBox: {
    width: 38,
    height: 38,
    borderRadius: Shapes.small,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.two,
  },
  historyContent: {
    flex: 1,
  },
  historyTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyIp: {
    fontSize: 14,
  },
  historyBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  driveLabel: {
    fontSize: 11,
    fontWeight: "600",
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
  targetAddressText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: Spacing.two,
    fontVariant: ["tabular-nums"],
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.one,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  prefCard: {
    marginBottom: Spacing.three,
  },
  prefDesc: {
    fontSize: 12,
    lineHeight: 17,
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
    paddingVertical: 10,
    borderRadius: Shapes.small,
  },
  themeModeText: {
    fontSize: 13,
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Spacing.three,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Shapes.large,
    borderWidth: 1,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: Shapes.full,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  presetLabel: {
    fontSize: 12,
  },
  tonalPreviewBox: {
    padding: Spacing.three,
    borderRadius: Shapes.medium,
    borderWidth: 1,
  },
  previewTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: Spacing.two,
  },
  swatchRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  swatchItem: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Shapes.small,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchText: {
    fontSize: 11,
    fontWeight: "700",
  },
  pageSizePillsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: 4,
  },
  prefSizePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Shapes.medium,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  prefSizeText: {
    fontSize: 13,
  },
  defaultTag: {
    fontSize: 10,
    marginTop: 2,
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
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: Spacing.one,
  },
  inputBox: {
    height: 48,
    borderRadius: Shapes.medium,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    justifyContent: "center",
  },
  input: {
    fontSize: 15,
    height: 48,
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: Spacing.three,
  },
  dbInfoCard: {
    marginBottom: Spacing.three,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  dbStatCol: {
    alignItems: "center",
  },
  dbStatLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  dbStatVal: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  lastSyncLabel: {
    fontSize: 11,
    textAlign: "center",
    marginTop: Spacing.two,
  },
  faqSection: {
    marginTop: Spacing.two,
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    marginRight: Spacing.two,
  },
  faqAnswer: {
    fontSize: 12,
    marginTop: Spacing.two,
    lineHeight: 18,
  },
});

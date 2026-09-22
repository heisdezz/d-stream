import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
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
import { MaterialIcons } from "@expo/vector-icons";

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
  } = useAppStore();

  const [inputIp, setInputIp] = useState<string>(ip);
  const [inputPort, setInputPort] = useState<string>(port.toString());
  const [inputDlLocation, setInputDlLocation] =
    useState<string>(downloadLocation);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

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
      a: 'Open the External Drive Media Organizer desktop app, navigate to Settings in the sidebar, scroll to "Local Network Mobile Sync", and toggle the switch to ON.',
    },
    {
      q: "Cannot connect from mobile device?",
      a: "Verify both phone and desktop are on the same Wi-Fi network (not guest Wi-Fi). If Linux firewall (ufw) is active, allow the port via: sudo ufw allow 8080/tcp",
    },
    {
      q: "How does offline video downloading work?",
      a: "Tap the Download button on any video or photo detail screen. Files are saved locally to your configured download location inside album subfolders, allowing complete offline playback when disconnected from the LAN server.",
    },
    {
      q: "How does database snapshot sync work?",
      a: "The server creates an exFAT-safe SQLite VACUUM INTO snapshot and streams .media_library.db over LAN. The mobile app saves it locally, allowing complete offline search and inspection.",
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
                        : colors.surfaceContainerHighest,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={isCurrent ? "check-circle" : "router"}
                    size={20}
                    color={
                      isCurrent ? colors.onSecondary : colors.onSurfaceVariant
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
                        variant="secondary"
                        size="small"
                        style={{ marginLeft: Spacing.one }}
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

        {/* Theme Mode Selector (System / Light / Dark) */}
        <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>
          Appearance Mode
        </Text>
        <View
          style={[
            styles.themeModeRow,
            {
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          {(
            [
              { mode: "system", label: "Auto", icon: "settings-brightness" },
              { mode: "light", label: "Light", icon: "light-mode" },
              { mode: "dark", label: "Dark", icon: "dark-mode" },
            ] as { mode: ThemeMode; label: string; icon: any }[]
          ).map((item) => {
            const isSelected = themeMode === item.mode;
            return (
              <Pressable
                key={item.mode}
                onPress={() => setThemeMode(item.mode)}
                style={({ pressed }) => [
                  styles.themeModeBtn,
                  isSelected && {
                    backgroundColor: colors.surface,
                    borderColor: colors.outlineVariant,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <MaterialIcons
                  name={item.icon}
                  size={16}
                  color={isSelected ? colors.primary : colors.onSurfaceVariant}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.themeModeText,
                    {
                      color: isSelected
                        ? colors.primary
                        : colors.onSurfaceVariant,
                      fontWeight: isSelected ? "800" : "600",
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Accent Color Palette Selector */}
        <Text
          style={[
            styles.inputLabel,
            { color: colors.onSurfaceVariant, marginTop: Spacing.three },
          ]}
        >
          Color Theme & Accents
        </Text>
        <View style={styles.presetGrid}>
          {THEME_ACCENT_PRESETS.map((preset) => {
            const isSelected = themeAccent === preset.id;
            return (
              <Pressable
                key={preset.id}
                onPress={() => setThemeAccent(preset.id)}
                style={({ pressed }) => [
                  styles.presetChip,
                  {
                    backgroundColor: isSelected
                      ? colors.primaryContainer
                      : colors.surfaceContainerLow,
                    borderColor: isSelected
                      ? colors.primary
                      : colors.outlineVariant,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View
                  style={[
                    styles.colorDot,
                    {
                      backgroundColor: preset.isSystem
                        ? colors.primary
                        : preset.color,
                    },
                  ]}
                >
                  {isSelected && (
                    <MaterialIcons name="check" size={14} color="#FFF" />
                  )}
                </View>
                <Text
                  style={[
                    styles.presetLabel,
                    {
                      color: isSelected
                        ? colors.onPrimaryContainer
                        : colors.onSurface,
                      fontWeight: isSelected ? "800" : "600",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {preset.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Live M3 Tonal Preview Swatch */}
        <View
          style={[
            styles.tonalPreviewBox,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Text
            style={[styles.previewTitle, { color: colors.onSurfaceVariant }]}
          >
            ACTIVE TONAL SCHEME PREVIEW ({isDark ? "DARK" : "LIGHT"})
          </Text>
          <View style={styles.swatchRow}>
            <View
              style={[styles.swatchItem, { backgroundColor: colors.primary }]}
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
                { backgroundColor: colors.secondaryContainer },
              ]}
            >
              <Text
                style={[
                  styles.swatchText,
                  { color: colors.onSecondaryContainer },
                ]}
              >
                Secondary
              </Text>
            </View>
            <View
              style={[
                styles.swatchItem,
                { backgroundColor: colors.tertiaryContainer },
              ]}
            >
              <Text
                style={[
                  styles.swatchText,
                  { color: colors.onTertiaryContainer },
                ]}
              >
                Tertiary
              </Text>
            </View>
          </View>
        </View>
      </M3Card>

      {/* Media Download & Offline Location Card */}
      <M3Card variant="elevated" style={styles.configCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="folder-zip" size={22} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Offline Media Storage
          </Text>
          <M3Badge
            label={`${downloadedCount} saved`}
            variant={downloadedCount > 0 ? "secondary" : "surface"}
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
          Specify folder path for offline video and photo downloads. Downloaded
          items are automatically stored inside album subfolders (e.g.
          Movies/d-stream/&lt;AlbumName&gt;/) for offline playback.
        </Text>

        <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>
          Storage Location Path
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
            placeholder="Movies/d-stream"
            placeholderTextColor={colors.outline}
            style={[styles.input, { color: colors.onSurface }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.buttonRow}>
          <M3Button
            label="Save Location"
            icon="save"
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

      {/* Display & Pagination Preferences Card */}
      <M3Card variant="elevated" style={styles.prefCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="tune" size={22} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Display & Pagination
          </Text>
          <M3Badge
            label={`${pageSize} / page`}
            variant="primary"
            size="small"
            style={{ marginLeft: "auto" }}
          />
        </View>

        <Text style={[styles.prefDesc, { color: colors.onSurfaceVariant }]}>
          Choose how many media items are loaded per page in Media Explorer and
          Album galleries. Multiples of 24 (min: 24, max: 180).
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pageSizePillsContainer}
          style={{ marginTop: Spacing.two }}
        >
          {PAGE_SIZE_OPTIONS.map((size) => {
            const isSelected = pageSize === size;
            return (
              <Pressable
                key={size}
                onPress={() => handleSelectPageSize(size)}
                style={({ pressed }) => [
                  styles.prefSizePill,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : colors.surfaceContainerHighest,
                    borderColor: isSelected
                      ? colors.primary
                      : colors.outlineVariant,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={[
                    styles.prefSizeText,
                    {
                      color: isSelected ? colors.onPrimary : colors.onSurface,
                      fontWeight: isSelected ? "900" : "600",
                    },
                  ]}
                >
                  {size}
                </Text>
                {size === 96 && (
                  <Text
                    style={[
                      styles.defaultTag,
                      {
                        color: isSelected ? colors.onPrimary : colors.outline,
                      },
                    ]}
                  >
                    (Default)
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </M3Card>

      {/* Local SQLite Database Info */}
      <M3Card variant="filled" style={styles.dbInfoCard}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="storage" size={22} color={colors.secondary} />
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            Local Database State
          </Text>
          <M3Badge
            label={stats.total_items > 0 ? "ACTIVE" : "EMPTY"}
            variant={stats.total_items > 0 ? "primary" : "surface"}
            size="small"
            style={{ marginLeft: "auto" }}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.dbStatCol}>
            <Text style={[styles.dbStatLabel, { color: colors.outline }]}>
              Total Media
            </Text>
            <Text style={[styles.dbStatVal, { color: colors.onSurface }]}>
              {stats.total_items}
            </Text>
          </View>
          <View style={styles.dbStatCol}>
            <Text style={[styles.dbStatLabel, { color: colors.outline }]}>
              Albums
            </Text>
            <Text style={[styles.dbStatVal, { color: colors.onSurface }]}>
              {stats.albums}
            </Text>
          </View>
          <View style={styles.dbStatCol}>
            <Text style={[styles.dbStatLabel, { color: colors.outline }]}>
              DB Size
            </Text>
            <Text style={[styles.dbStatVal, { color: colors.onSurface }]}>
              {stats.db_size_formatted}
            </Text>
          </View>
        </View>

        {lastSyncTime && (
          <Text
            style={[styles.lastSyncLabel, { color: colors.onSurfaceVariant }]}
          >
            Last Synced: {new Date(lastSyncTime).toLocaleString()}
          </Text>
        )}
      </M3Card>

      {/* Troubleshooting FAQs */}
      <View style={styles.faqSection}>
        <Text
          style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}
        >
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
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  presetLabel: {
    fontSize: 12,
  },
  tonalPreviewBox: {
    padding: Spacing.two + 2,
    borderRadius: Shapes.medium,
    borderWidth: 1,
  },
  previewTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: Spacing.one,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 6,
  },
  swatchItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Shapes.small,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchText: {
    fontSize: 10,
    fontWeight: "700",
  },
  pageSizePillsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  prefSizePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Shapes.medium,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  prefSizeText: {
    fontSize: 14,
  },
  defaultTag: {
    fontSize: 9,
    marginTop: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.three,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginLeft: Spacing.one,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.one,
  },
  inputBox: {
    height: 48,
    borderRadius: Shapes.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    justifyContent: "center",
  },
  input: {
    fontSize: 15,
    height: "100%",
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: Spacing.four,
  },
  dbInfoCard: {
    marginBottom: Spacing.three,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
  },
  dbStatCol: {
    alignItems: "center",
  },
  dbStatLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  dbStatVal: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  lastSyncLabel: {
    fontSize: 11,
    textAlign: "center",
    marginTop: Spacing.one,
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

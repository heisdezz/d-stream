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
import tw from "twrnc";

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
      style={[tw`flex-1`, { backgroundColor: colors.background }]}
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
        style={tw`mb-4`}
      />

      {/* Error Banner */}
      {errorMessage && (
        <M3Card
          variant="filled"
          style={[
            tw`flex-row items-center p-3 rounded-xl mb-3`,
            { backgroundColor: colors.errorContainer },
          ]}
        >
          <MaterialIcons
            name="error-outline"
            size={20}
            color={colors.onErrorContainer}
          />
          <Text
            style={[
              tw`text-xs font-semibold ml-2 flex-1`,
              { color: colors.onErrorContainer },
            ]}
          >
            {errorMessage}
          </Text>
        </M3Card>
      )}

      {/* Sync Progress */}
      {syncProgress && (
        <M3Card variant="outlined" style={tw`mb-4`}>
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
        <View style={tw`mb-4`}>
          <Text
            style={[
              tw`text-[11px] font-extrabold tracking-wider mb-2`,
              { color: colors.primary },
            ]}
          >
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
                  tw`flex-row items-center p-2.5 rounded-xl border mb-2`,
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
                    tw`w-9 h-9 rounded-full items-center justify-center mr-2.5`,
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

                <View style={tw`flex-1`}>
                  <View style={tw`flex-row items-center`}>
                    <Text
                      style={[
                        tw`text-sm font-bold`,
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
                        style={tw`ml-2`}
                      />
                    )}
                  </View>
                  <Text style={[tw`text-xs mt-0.5`, { color: colors.outline }]}>
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
                  style={tw`p-1.5 ml-1`}
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
        <M3Card variant="elevated" style={tw`p-4 mb-4`}>
          <View style={tw`flex-row items-center mb-3`}>
            <MaterialIcons name="tune" size={20} color={colors.primary} />
            <Text
              style={[tw`text-sm font-bold ml-2`, { color: colors.onSurface }]}
            >
              Manual Connection
            </Text>
          </View>

          <View style={tw`flex-row mb-4`}>
            <View style={tw`flex-3 mr-2`}>
              <Text
                style={[
                  tw`text-xs font-semibold mb-1.5`,
                  { color: colors.onSurfaceVariant },
                ]}
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
                  tw`h-11 rounded-xl border px-3 text-sm`,
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

            <View style={tw`flex-1`}>
              <Text
                style={[
                  tw`text-xs font-semibold mb-1.5`,
                  { color: colors.onSurfaceVariant },
                ]}
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
                  tw`h-11 rounded-xl border px-3 text-sm`,
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

          <View style={tw`flex-row`}>
            <M3Button
              label={status === "testing" ? "Testing..." : "Test Connection"}
              icon="wifi-find"
              variant="outlined"
              loading={status === "testing"}
              onPress={handleApplyAndTest}
              style={tw`flex-1 mr-2`}
            />
            <M3Button
              label={status === "downloading" ? "Syncing..." : "Sync DB"}
              icon="sync"
              variant="filled"
              loading={status === "downloading" || status === "migrating"}
              onPress={handleSyncPress}
              style={tw`flex-1`}
            />
          </View>
        </M3Card>
      )}

      {/* Appearance & Color Scheme Card */}
      <M3Card variant="elevated" style={tw`p-4 mb-4`}>
        <View style={tw`flex-row items-center mb-3`}>
          <MaterialIcons name="palette" size={20} color={colors.primary} />
          <Text
            style={[tw`text-sm font-bold ml-2`, { color: colors.onSurface }]}
          >
            Theme & Appearance
          </Text>
        </View>

        {/* Theme Mode Switcher */}
        <View
          style={[
            tw`flex-row rounded-xl border p-1 mb-3`,
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
                  tw`flex-1 flex-row items-center justify-center py-2 rounded-lg`,
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
                  style={tw`mr-1.5`}
                />
                <Text
                  style={[
                    tw`text-xs`,
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
        <View style={tw`flex-row flex-wrap gap-2`}>
          {THEME_ACCENT_PRESETS.map((preset) => {
            const isSelected = themeAccent === preset.id;
            return (
              <Pressable
                key={preset.id}
                onPress={() => setThemeAccent(preset.id)}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                style={({ pressed }) => [
                  tw`flex-row items-center py-1.5 px-2.5 rounded-full border`,
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
                    tw`w-3.5 h-3.5 rounded-full mr-1.5 items-center justify-center`,
                    {
                      backgroundColor:
                        preset.id === "system" ? colors.primary : preset.color,
                    },
                  ]}
                >
                  {preset.id === "system" && (
                    <MaterialIcons
                      name="wallpaper"
                      size={9}
                      color={colors.onPrimary}
                    />
                  )}
                </View>
                <Text
                  style={[
                    tw`text-xs`,
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
      <M3Card variant="elevated" style={tw`p-4 mb-4`}>
        <View style={tw`flex-row items-center justify-between`}>
          <View style={tw`flex-1 mr-3`}>
            <View style={tw`flex-row items-center`}>
              <MaterialIcons
                name="movie-filter"
                size={20}
                color={colors.primary}
                style={tw`mr-1.5`}
              />
              <Text
                style={[tw`text-sm font-bold`, { color: colors.onSurface }]}
              >
                Play as Shorts / Reels
              </Text>
            </View>
            <Text
              style={[tw`text-xs mt-1`, { color: colors.onSurfaceVariant }]}
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
      <M3Card variant="elevated" style={tw`p-4 mb-4`}>
        <View style={tw`flex-row items-center mb-3`}>
          <MaterialIcons name="folder" size={20} color={colors.primary} />
          <Text
            style={[tw`text-sm font-bold ml-2`, { color: colors.onSurface }]}
          >
            Download Directory
          </Text>
        </View>

        <TextInput
          value={inputDlLocation}
          onChangeText={setInputDlLocation}
          placeholder="d-stream-downloads"
          placeholderTextColor={colors.outline}
          style={[
            tw`h-11 rounded-xl border px-3 text-sm mb-3`,
            {
              backgroundColor: colors.surfaceContainerHighest,
              borderColor: colors.outlineVariant,
              color: colors.onSurface,
            },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={tw`flex-row`}>
          <M3Button
            label="Save"
            icon="check"
            variant="filled"
            onPress={handleSaveDownloadLocation}
            style={tw`flex-1 mr-2`}
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
      <M3Card variant="elevated" style={tw`p-4 mb-4`}>
        <View style={tw`flex-row items-center mb-3`}>
          <MaterialIcons name="view-module" size={20} color={colors.primary} />
          <Text
            style={[tw`text-sm font-bold ml-2`, { color: colors.onSurface }]}
          >
            Items per Page
          </Text>
        </View>

        <View style={tw`flex-row gap-2`}>
          {PAGE_SIZE_OPTIONS.map((size) => {
            const isSelected = (pageSize || 96) === size;
            return (
              <Pressable
                key={size}
                onPress={() => handleSelectPageSize(size)}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                style={({ pressed }) => [
                  tw`flex-1 items-center justify-center py-2.5 rounded-xl border`,
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
                    tw`text-sm`,
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
      <M3Card variant="elevated" style={tw`p-4 mb-4`}>
        <View style={tw`flex-row items-center mb-3`}>
          <MaterialIcons name="storage" size={20} color={colors.primary} />
          <Text
            style={[tw`text-sm font-bold ml-2`, { color: colors.onSurface }]}
          >
            Local Database
          </Text>
          {lastSyncTime && (
            <Text style={[tw`ml-auto text-xs`, { color: colors.outline }]}>
              {formatRelativeTime(lastSyncTime)}
            </Text>
          )}
        </View>

        <View style={tw`flex-row justify-between items-center pt-1`}>
          <View style={tw`items-center flex-1`}>
            <Text
              style={[tw`text-base font-extrabold`, { color: colors.primary }]}
            >
              {stats.total_items.toLocaleString()}
            </Text>
            <Text
              style={[
                tw`text-[11px] font-semibold mt-0.5`,
                { color: colors.onSurfaceVariant },
              ]}
            >
              Items
            </Text>
          </View>

          <View style={tw`items-center flex-1`}>
            <Text
              style={[tw`text-base font-extrabold`, { color: colors.primary }]}
            >
              {stats.albums.toLocaleString()}
            </Text>
            <Text
              style={[
                tw`text-[11px] font-semibold mt-0.5`,
                { color: colors.onSurfaceVariant },
              ]}
            >
              Albums
            </Text>
          </View>

          <View style={tw`items-center flex-1`}>
            <Text
              style={[tw`text-base font-extrabold`, { color: colors.primary }]}
            >
              {stats.tags.toLocaleString()}
            </Text>
            <Text
              style={[
                tw`text-[11px] font-semibold mt-0.5`,
                { color: colors.onSurfaceVariant },
              ]}
            >
              Tags
            </Text>
          </View>

          <View style={tw`items-center flex-1`}>
            <Text
              style={[tw`text-base font-extrabold`, { color: colors.primary }]}
            >
              {stats.db_size_formatted || "0 B"}
            </Text>
            <Text
              style={[
                tw`text-[11px] font-semibold mt-0.5`,
                { color: colors.onSurfaceVariant },
              ]}
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
  contentContainer: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
});

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { SyncStatus } from '@/types/models';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

export interface ConnectionStatusProps {
  status: SyncStatus;
  serverIp: string;
  serverPort: number;
  driveName?: string;
  latencyMs?: number | null;
  style?: ViewStyle;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  serverIp,
  serverPort,
  driveName,
  latencyMs,
  style,
}) => {
  const { colors } = useMaterialTheme();

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
      case 'success':
        return {
          bg: colors.primaryContainer,
          text: colors.onPrimaryContainer,
          icon: 'check-circle' as const,
          label: driveName ? `Connected (${driveName})` : 'LAN Server Online',
          dotColor: '#10B981',
        };
      case 'testing':
      case 'downloading':
      case 'migrating':
        return {
          bg: colors.secondaryContainer,
          text: colors.onSecondaryContainer,
          icon: 'sync' as const,
          label: status === 'downloading' ? 'Syncing SQLite DB...' : 'Connecting to Server...',
          dotColor: '#F59E0B',
        };
      case 'error':
      case 'idle':
      default:
        return {
          bg: colors.surfaceContainerHighest,
          text: colors.onSurfaceVariant,
          icon: 'cloud-off' as const,
          label: 'Server Offline',
          dotColor: '#EF4444',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: config.bg,
          borderColor: colors.outlineVariant,
        },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.dotColor }]} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: config.text }]} numberOfLines={1}>
          {config.label}
        </Text>
        <Text style={[styles.subtitle, { color: config.text, opacity: 0.8 }]} numberOfLines={1}>
          {serverIp}:{serverPort} {latencyMs ? `• ${latencyMs}ms` : ''}
        </Text>
      </View>
      <MaterialIcons name={config.icon} size={20} color={config.text} />
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Shapes.large,
    borderWidth: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.two,
  },
  content: {
    flex: 1,
    marginRight: Spacing.two,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
});

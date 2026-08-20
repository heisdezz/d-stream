import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { SyncProgress } from '@/types/models';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing } from '@/constants/theme';

export interface SyncProgressBarProps {
  progress: SyncProgress;
  style?: ViewStyle;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const SyncProgressBar: React.FC<SyncProgressBarProps> = ({
  progress,
  style,
}) => {
  const { colors } = useMaterialTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.onSurface }]}>
          Downloading Database Snapshot
        </Text>
        <Text style={[styles.percentage, { color: colors.primary }]}>
          {progress.percentage}%
        </Text>
      </View>

      <View
        style={[
          styles.track,
          { backgroundColor: colors.surfaceContainerHighest },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(4, Math.min(100, progress.percentage))}%`,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>

      <View style={styles.footerRow}>
        <Text style={[styles.byteText, { color: colors.outline }]}>
          {formatBytes(progress.bytesWritten)}
          {progress.contentLength > 0
            ? ` / ${formatBytes(progress.contentLength)}`
            : ''}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  percentage: {
    fontSize: 14,
    fontWeight: '800',
  },
  track: {
    height: 8,
    borderRadius: Shapes.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Shapes.full,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  byteText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

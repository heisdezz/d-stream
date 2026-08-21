import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { useMaterialTheme } from '@/hooks/use-material-theme';
import { Shapes, Spacing, Elevation } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { PAGE_SIZE_OPTIONS } from '@/services/storage';

export interface PaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  const { colors } = useMaterialTheme();
  const [jumpModalVisible, setJumpModalVisible] = useState(false);
  const [jumpInput, setJumpInput] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handleJumpSubmit = () => {
    const target = parseInt(jumpInput, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      onPageChange(target);
      setJumpModalVisible(false);
      setJumpInput('');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
      {/* Range Info & Page Size Options */}
      <View style={styles.topInfoRow}>
        <Text style={[styles.rangeText, { color: colors.onSurfaceVariant }]}>
          Showing <Text style={{ fontWeight: '800', color: colors.onSurface }}>{startItem}-{endItem}</Text> of{' '}
          <Text style={{ fontWeight: '800', color: colors.onSurface }}>{totalItems.toLocaleString()}</Text> items
        </Text>

        {onPageSizeChange && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pageSizeScroll}
            style={styles.pageSizeWrapper}
          >
            <Text style={[styles.pageSizeLabel, { color: colors.outline }]}>Per page:</Text>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <Pressable
                key={size}
                onPress={() => onPageSizeChange(size)}
                style={[
                  styles.sizePill,
                  {
                    backgroundColor: pageSize === size ? colors.primary : colors.surfaceContainerHighest,
                    borderColor: pageSize === size ? colors.primary : colors.outlineVariant,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sizePillText,
                    {
                      color: pageSize === size ? colors.onPrimary : colors.onSurfaceVariant,
                      fontWeight: pageSize === size ? '800' : '600',
                    },
                  ]}
                >
                  {size}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Navigation Buttons Row */}
      <View style={styles.navRow}>
        {/* First Page */}
        <Pressable
          disabled={!canGoPrev}
          onPress={() => onPageChange(1)}
          style={({ pressed }) => [
            styles.navBtn,
            {
              backgroundColor: colors.surfaceContainerHigh,
              opacity: canGoPrev ? (pressed ? 0.7 : 1) : 0.35,
            },
          ]}
        >
          <MaterialIcons name="first-page" size={20} color={colors.onSurface} />
        </Pressable>

        {/* Prev Page */}
        <Pressable
          disabled={!canGoPrev}
          onPress={() => onPageChange(currentPage - 1)}
          style={({ pressed }) => [
            styles.navBtn,
            styles.prevNextBtn,
            {
              backgroundColor: colors.surfaceContainerHigh,
              opacity: canGoPrev ? (pressed ? 0.7 : 1) : 0.35,
            },
          ]}
        >
          <MaterialIcons name="chevron-left" size={20} color={colors.onSurface} />
          <Text style={[styles.navBtnLabel, { color: colors.onSurface }]}>Prev</Text>
        </Pressable>

        {/* Jump Trigger Badge */}
        <Pressable
          onPress={() => {
            setJumpInput(currentPage.toString());
            setJumpModalVisible(true);
          }}
          style={({ pressed }) => [
            styles.pageIndicatorBox,
            {
              backgroundColor: colors.primaryContainer,
              borderColor: colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.pageIndicatorCurrent, { color: colors.onPrimaryContainer }]}>
            {currentPage}
          </Text>
          <Text style={[styles.pageIndicatorTotal, { color: colors.onPrimaryContainer }]}>
            / {totalPages}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={16} color={colors.onPrimaryContainer} />
        </Pressable>

        {/* Next Page */}
        <Pressable
          disabled={!canGoNext}
          onPress={() => onPageChange(currentPage + 1)}
          style={({ pressed }) => [
            styles.navBtn,
            styles.prevNextBtn,
            {
              backgroundColor: colors.surfaceContainerHigh,
              opacity: canGoNext ? (pressed ? 0.7 : 1) : 0.35,
            },
          ]}
        >
          <Text style={[styles.navBtnLabel, { color: colors.onSurface }]}>Next</Text>
          <MaterialIcons name="chevron-right" size={20} color={colors.onSurface} />
        </Pressable>

        {/* Last Page */}
        <Pressable
          disabled={!canGoNext}
          onPress={() => onPageChange(totalPages)}
          style={({ pressed }) => [
            styles.navBtn,
            {
              backgroundColor: colors.surfaceContainerHigh,
              opacity: canGoNext ? (pressed ? 0.7 : 1) : 0.35,
            },
          ]}
        >
          <MaterialIcons name="last-page" size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      {/* Jump to Page Modal */}
      <Modal
        visible={jumpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJumpModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setJumpModalVisible(false)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surfaceContainerHighest }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Jump to Page</Text>
            <Text style={[styles.modalSubtitle, { color: colors.onSurfaceVariant }]}>
              Enter a page between 1 and {totalPages}
            </Text>

            <TextInput
              value={jumpInput}
              onChangeText={setJumpInput}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              style={[
                styles.modalInput,
                {
                  color: colors.onSurface,
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.primary,
                },
              ]}
              onSubmitEditing={handleJumpSubmit}
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                onPress={() => setJumpModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: colors.surfaceContainer }]}
              >
                <Text style={{ color: colors.onSurface, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleJumpSubmit}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: colors.onPrimary, fontWeight: '800' }}>Jump</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: Shapes.large,
    padding: Spacing.three,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
    borderWidth: 1,
    ...Elevation.level1,
  },
  topInfoRow: {
    marginBottom: Spacing.two,
  },
  rangeText: {
    fontSize: 12,
    marginBottom: 6,
  },
  pageSizeWrapper: {
    flexDirection: 'row',
  },
  pageSizeScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  pageSizeLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 4,
  },
  sizePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Shapes.small,
    borderWidth: 1,
  },
  sizePillText: {
    fontSize: 11,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  navBtn: {
    height: 38,
    width: 38,
    borderRadius: Shapes.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevNextBtn: {
    flex: 1,
    width: undefined,
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  navBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 2,
  },
  pageIndicatorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: Shapes.small,
    borderWidth: 1,
  },
  pageIndicatorCurrent: {
    fontSize: 14,
    fontWeight: '900',
  },
  pageIndicatorTotal: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Shapes.large,
    padding: Spacing.four,
    ...Elevation.level3,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: Spacing.three,
  },
  modalInput: {
    height: 48,
    borderWidth: 2,
    borderRadius: Shapes.small,
    paddingHorizontal: Spacing.two,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  modalBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Shapes.small,
  },
});

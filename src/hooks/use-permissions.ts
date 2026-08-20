import { useEffect, useState, useCallback } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';

export interface PermissionsState {
  hasStoragePermission: boolean;
  isLoading: boolean;
  requestPermissions: () => Promise<boolean>;
}

export function usePermissions(): PermissionsState {
  const [hasStoragePermission, setHasStoragePermission] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      setHasStoragePermission(true);
      setIsLoading(false);
      return true;
    }

    try {
      const apiLevel = Platform.Version;

      if (typeof apiLevel === 'number' && apiLevel >= 33) {
        // Android 13+ (API 33+) granular media permissions
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        ]);

        const imagesGranted =
          results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const videoGranted =
          results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] ===
          PermissionsAndroid.RESULTS.GRANTED;

        const granted = imagesGranted || videoGranted;
        setHasStoragePermission(granted);
        setIsLoading(false);
        return granted;
      } else {
        // Android 12 and below (API <= 32)
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);

        const readGranted =
          results[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const writeGranted =
          results[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] ===
          PermissionsAndroid.RESULTS.GRANTED;

        const granted = readGranted || writeGranted;
        setHasStoragePermission(granted);
        setIsLoading(false);
        return granted;
      }
    } catch (err) {
      console.warn('[Permissions] Failed to request permissions:', err);
      setHasStoragePermission(true);
      setIsLoading(false);
      return true;
    }
  }, []);

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  return {
    hasStoragePermission,
    isLoading,
    requestPermissions,
  };
}

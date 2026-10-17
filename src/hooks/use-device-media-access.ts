import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { isDeviceMediaAvailable, requestDeviceMediaAccess } from '@/services/device-media';

export function useDeviceMediaAccess() {
  const requiresBuild = !isDeviceMediaAvailable() ||
    (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
  const [status, setStatus] = useState<'loading' | 'granted' | 'denied' | 'error'>(
    requiresBuild ? 'denied' : 'loading',
  );

  const retry = useCallback(async () => {
    if (requiresBuild) return;
    setStatus('loading');
    try {
      setStatus((await requestDeviceMediaAccess()) ? 'granted' : 'denied');
    } catch {
      setStatus('error');
    }
  }, [requiresBuild]);

  useEffect(() => { void retry(); }, [retry]);
  return { requiresBuild, status, retry };
}

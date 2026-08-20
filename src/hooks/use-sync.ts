import { useAppStore } from '@/store/use-app-store';

export function useSync() {
  const store = useAppStore();
  return {
    ip: store.ip,
    port: store.port,
    setIp: store.setIp,
    setPort: store.setPort,
    serverHistory: store.serverHistory,
    serverInfo: store.serverInfo,
    status: store.status,
    errorMessage: store.errorMessage,
    syncProgress: store.syncProgress,
    lastSyncTime: store.lastSyncTime,
    latencyMs: store.latencyMs,
    checkConnection: store.checkConnection,
    syncDatabase: store.syncDatabase,
    updateServerConfig: async (ip: string, port: number) => {
      store.setIp(ip);
      store.setPort(port);
      await store.checkConnection(ip, port);
    },
    removeHistoryServer: store.removeHistoryServer,
  };
}

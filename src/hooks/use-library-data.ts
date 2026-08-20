import { useAppStore } from '@/store/use-app-store';

export function useLibraryData() {
  const store = useAppStore();
  return {
    stats: store.stats,
    hasDatabase: store.hasDatabase,
    mediaItems: store.mediaItems,
    totalMediaCount: store.totalMediaCount,
    albums: store.albums,
    tags: store.tags,
    recentMedia: store.recentMedia,
    isLoading: store.isLoading,
    isRefreshing: store.isRefreshing,
    refreshAll: store.refreshLibrary,
    loadMore: store.loadMoreMedia,
  };
}

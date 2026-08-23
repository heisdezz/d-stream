import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLibraryStats,
  getAlbums,
  getTags,
  getRecentMedia,
  getMediaItems,
  getAlbumById,
  getMediaItemById,
} from '@/services/local-db';
import { GetMediaOptions } from '@/services/local-db';

export function useLibraryStatsQuery() {
  return useQuery({
    queryKey: ['library-stats'],
    queryFn: () => getLibraryStats(),
    staleTime: 1000 * 30,
  });
}

export function useAlbumsQuery() {
  return useQuery({
    queryKey: ['albums'],
    queryFn: () => getAlbums(),
    staleTime: 1000 * 60,
  });
}

export function useTagsQuery() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => getTags(),
    staleTime: 1000 * 60,
  });
}

export function useRecentMediaQuery(limit: number = 12) {
  return useQuery({
    queryKey: ['recent-media', limit],
    queryFn: () => getRecentMedia(limit),
    staleTime: 1000 * 30,
  });
}

export function useMediaItemsQuery(params: GetMediaOptions, enabled: boolean = true) {
  return useQuery({
    queryKey: ['media-items', params],
    queryFn: () => getMediaItems(params),
    staleTime: 1000 * 15,
    enabled,
  });
}

export function useAlbumDetailsQuery(albumId: number) {
  return useQuery({
    queryKey: ['album-meta', albumId],
    queryFn: () => getAlbumById(albumId),
    enabled: !isNaN(albumId) && albumId > 0,
    staleTime: 1000 * 60,
  });
}

export function useMediaItemDetailsQuery(mediaId: number) {
  return useQuery({
    queryKey: ['media-item-detail', mediaId],
    queryFn: () => getMediaItemById(mediaId),
    enabled: !isNaN(mediaId) && mediaId > 0,
  });
}

export function useInvalidateLibraryQueries() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['library-stats'] });
    queryClient.invalidateQueries({ queryKey: ['albums'] });
    queryClient.invalidateQueries({ queryKey: ['tags'] });
    queryClient.invalidateQueries({ queryKey: ['recent-media'] });
    queryClient.invalidateQueries({ queryKey: ['media-items'] });
    queryClient.invalidateQueries({ queryKey: ['album-meta'] });
  };
}

import { atom } from 'jotai';

export type MediaTypeFilter = 'all' | 'image' | 'video';
export type SortByField = 'created_at' | 'file_size' | 'current_relative_path';
export type SortOrder = 'ASC' | 'DESC';
export type ViewLayoutMode = 'grid' | 'grid3' | 'list';

export const searchQueryAtom = atom<string>('');
export const mediaTypeFilterAtom = atom<MediaTypeFilter>('all');
export const selectedAlbumIdAtom = atom<number | undefined>(undefined);
export const selectedTagIdAtom = atom<number | undefined>(undefined);
export const sortByAtom = atom<SortByField>('created_at');
export const sortOrderAtom = atom<SortOrder>('DESC');
export const viewModeAtom = atom<ViewLayoutMode>('grid');

// Real pagination atoms - default 96
export const currentPageAtom = atom<number>(1);
export const pageSizeAtom = atom<number>(96);

import { atom } from 'nanostores';

export const isSearchOpenStore = atom<boolean>(false);

export function openSearch() {
  isSearchOpenStore.set(true);
}

export function closeSearch() {
  isSearchOpenStore.set(false);
}

export function toggleSearch() {
  isSearchOpenStore.set(!isSearchOpenStore.get());
}


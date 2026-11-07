import { atom } from 'nanostores';

export const isNavOpenStore = atom<boolean>(false);

export function toggleNav() {
  isNavOpenStore.set(!isNavOpenStore.get());
}

export function closeNav() {
  isNavOpenStore.set(false);
}


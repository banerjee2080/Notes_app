import { create } from "zustand";

export const useSyncStore = create((set) => ({
  isSyncing: false,
  setSyncing: (status) => set({ isSyncing: status }),
}));

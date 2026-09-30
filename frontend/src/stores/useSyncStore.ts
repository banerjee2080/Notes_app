import { create } from "zustand";

interface SyncState {
  isSyncing: boolean;
  setSyncing: (status: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  setSyncing: (status) => set({ isSyncing: status }),
}));

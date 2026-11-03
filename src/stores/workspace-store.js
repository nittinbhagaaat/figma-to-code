"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Remembers the active workspace id (non-sensitive) between visits. */
export const useWorkspaceStore = create(persist((set) => ({
  workspaceId: null,
  setWorkspaceId: (workspaceId) => set({ workspaceId }),
}), { name: "f2c-workspace" }));

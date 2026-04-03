import { create } from "zustand";

interface ProjectState {
  currentProjectId: number | null;
  setCurrentProject: (id: number | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: null,
  setCurrentProject: (id) => set({ currentProjectId: id }),
}));

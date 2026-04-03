import { create } from "zustand";
import type { Organization, Project } from "@/types";

interface OrgState {
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization) => void;
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
}

export const useOrgStore = create<OrgState>((set) => ({
  currentOrg: JSON.parse(localStorage.getItem("currentOrg") ?? "null"),
  setCurrentOrg: (org) => {
    localStorage.setItem("currentOrg", JSON.stringify(org));
    set({ currentOrg: org });
  },
  currentProject: JSON.parse(localStorage.getItem("currentProject") ?? "null"),
  setCurrentProject: (project) => {
    if (project) {
      localStorage.setItem("currentProject", JSON.stringify(project));
    } else {
      localStorage.removeItem("currentProject");
    }
    set({ currentProject: project });
  },
}));

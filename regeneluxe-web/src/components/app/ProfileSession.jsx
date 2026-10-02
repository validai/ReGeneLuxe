"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { setActiveProfileId as persistWorkspaceId } from "../../data/profileScope.js";

const ProfileSessionContext = createContext({
  operator: null,
  profiles: [],
  activeProfile: null,
  workspace: null,
  connections: null,
  setActiveProfile: async () => {},
});

export function ProfileSessionProvider({
  operator: initialOperator = null,
  profiles: initialProfiles = [],
  activeProfile: initialActive = null,
  connections: initialConnections = null,
  children,
}) {
  const [operator, setOperator] = useState(initialOperator);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [activeProfile, setActiveProfileState] = useState(initialActive);
  const [connections, setConnections] = useState(initialConnections);

  const setActiveProfile = useCallback(async () => {
    /* One email = one workspace. Switching brands is not supported. */
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/operator/session");
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) return body;
    setOperator(body.operator || null);
    const workspace = body.workspace || body.activeProfile || null;
    setProfiles(workspace ? [workspace] : []);
    setActiveProfileState(workspace);
    if (workspace?.id) persistWorkspaceId(workspace.id);
    setConnections(body.connections || null);
    return body;
  }, []);

  const value = useMemo(() => ({
    operator,
    profiles,
    activeProfile,
    workspace: activeProfile,
    connections,
    setActiveProfile,
    refresh,
  }), [operator, profiles, activeProfile, connections, setActiveProfile, refresh]);

  return (
    <ProfileSessionContext.Provider value={value}>
      {children}
    </ProfileSessionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- session hook
export function useProfileSession() {
  return useContext(ProfileSessionContext);
}

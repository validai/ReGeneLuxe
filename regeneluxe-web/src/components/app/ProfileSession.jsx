"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { setActiveProfileId as persistActiveProfileId } from "../../data/profileScope.js";
import { hydrateFromSnapshot } from "../../data/operationalStore.js";

const ProfileSessionContext = createContext({
  operator: null,
  profiles: [],
  activeProfile: null,
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

  const setActiveProfile = useCallback(async (profileId) => {
    if (!profileId || profileId === operator?.id) return;
    const response = await fetch(`/api/profiles/${profileId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate" }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) {
      throw new Error(body.error || "Could not switch profile.");
    }
    persistActiveProfileId(profileId);
    if (body.operator) setOperator(body.operator);
    if (body.activeProfile) setActiveProfileState(body.activeProfile);
    try {
      const snap = await fetch("/api/data/snapshot");
      const snapBody = await snap.json();
      if (snap.ok && snapBody.data) hydrateFromSnapshot(snapBody.data);
    } catch {
      /* local cache stays until next boot */
    }
  }, [operator?.id]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/operator/session");
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) return body;
    setOperator(body.operator || null);
    setProfiles(Array.isArray(body.profiles) ? body.profiles : []);
    setActiveProfileState(body.activeProfile || null);
    setConnections(body.connections || null);
    return body;
  }, []);

  const value = useMemo(() => ({
    operator,
    profiles,
    activeProfile,
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

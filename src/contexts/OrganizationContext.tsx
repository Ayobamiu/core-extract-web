"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import {
  apiClient,
  Organization,
  OrganizationMember,
  OrganizationStats,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// Types
interface OrganizationContextType {
  // Current organization (selected by user)
  currentOrganization: Organization | null;
  switchOrganization: (organizationId: string) => void;

  // Organization list
  organizations: Organization[];
  isLoadingOrganizations: boolean;
  refreshOrganizations: () => Promise<void>;

  // Organization members
  members: OrganizationMember[];
  isLoadingMembers: boolean;
  refreshMembers: () => Promise<void>;

  // Organization stats
  stats: OrganizationStats | null;
  isLoadingStats: boolean;
  refreshStats: () => Promise<void>;

  // Organization management
  createOrganization: (data: {
    name: string;
    domain?: string;
  }) => Promise<Organization>;
  updateOrganization: (data: Partial<Organization>) => Promise<Organization>;
  deleteOrganization: () => Promise<void>;

  // Member management
  updateMemberRole: (userId: string, role: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;

  // Invitation management
  inviteMember: (email: string, role: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  // Current organization state
  const [currentOrganization, setCurrentOrganization] =
    useState<Organization | null>(null);

  // Organization list state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);

  // Organization members state
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Organization stats state
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Load organizations
  const refreshOrganizations = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;

    setIsLoadingOrganizations(true);
    try {
      const response = await apiClient.getOrganizations();
      if (response.success && response.data?.organizations) {
        setOrganizations(response.data.organizations);

        // Reset current organization when loading new user's organizations
        setCurrentOrganization(null);

        // Set current organization if none is selected
        if (response.data.organizations.length > 0) {
          // Try to get the last selected organization from localStorage
          const lastSelectedOrgId = localStorage.getItem(
            "lastSelectedOrganizationId"
          );
          const lastSelectedOrg = response.data.organizations.find(
            (org) => org.id === lastSelectedOrgId
          );

          if (lastSelectedOrg) {
            setCurrentOrganization(lastSelectedOrg);
          } else {
            // Default to the first organization (usually the user's default org)
            setCurrentOrganization(response.data.organizations[0]);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load organizations:", error);
    } finally {
      setIsLoadingOrganizations(false);
    }
  }, [isAuthenticated, user?.id]);

  // Load organization members
  const refreshMembers = useCallback(async () => {
    if (!currentOrganization) return;

    setIsLoadingMembers(true);
    try {
      const response = await apiClient.getOrganizationMembers(
        currentOrganization.id
      );
      if (response.success && response.data?.members) {
        setMembers(response.data.members);
      }
    } catch (error) {
      console.error("Failed to load organization members:", error);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [currentOrganization]);

  // Load organization stats
  const refreshStats = useCallback(async () => {
    if (!currentOrganization) return;

    setIsLoadingStats(true);
    try {
      const response = await apiClient.getOrganizationStats(
        currentOrganization.id
      );
      if (response.success && response.data?.stats) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error("Failed to load organization stats:", error);
    } finally {
      setIsLoadingStats(false);
    }
  }, [currentOrganization]);

  // Switch organization
  const switchOrganization = useCallback(
    (organizationId: string) => {
      const org = organizations.find((o) => o.id === organizationId);
      if (org) {
        setCurrentOrganization(org);
        localStorage.setItem("lastSelectedOrganizationId", organizationId);

        // Refresh members and stats for the new organization
        refreshMembers();
        // refreshStats();
      }
    },
    [organizations, refreshMembers]
  );

  // Organization management functions
  const createOrganization = async (data: {
    name: string;
    domain?: string;
  }): Promise<Organization> => {
    const response = await apiClient.createOrganization(data);
    if (response.success && response.data?.organization) {
      await refreshOrganizations();
      return response.data.organization;
    }
    throw new Error(response.error || "Failed to create organization");
  };

  const updateOrganization = async (
    data: Partial<Organization>
  ): Promise<Organization> => {
    if (!currentOrganization) throw new Error("No organization selected");

    const response = await apiClient.updateOrganization(
      currentOrganization.id,
      data
    );
    if (response.success && response.data?.organization) {
      await refreshOrganizations();
      setCurrentOrganization(response.data.organization);
      return response.data.organization;
    }
    throw new Error(response.error || "Failed to update organization");
  };

  const deleteOrganization = async (): Promise<void> => {
    if (!currentOrganization) throw new Error("No organization selected");

    const response = await apiClient.deleteOrganization(currentOrganization.id);
    if (response.success) {
      setCurrentOrganization(null);
      await refreshOrganizations();
    } else {
      throw new Error(response.error || "Failed to delete organization");
    }
  };

  // Member management functions
  const updateMemberRole = async (
    userId: string,
    role: string
  ): Promise<void> => {
    if (!currentOrganization) throw new Error("No organization selected");

    const response = await apiClient.updateMemberRole(
      currentOrganization.id,
      userId,
      role
    );
    if (response.success) {
      await refreshMembers();
    } else {
      throw new Error(response.error || "Failed to update member role");
    }
  };

  const removeMember = async (userId: string): Promise<void> => {
    if (!currentOrganization) throw new Error("No organization selected");

    const response = await apiClient.removeMember(
      currentOrganization.id,
      userId
    );
    if (response.success) {
      await refreshMembers();
    } else {
      throw new Error(response.error || "Failed to remove member");
    }
  };

  // Invitation management functions
  const inviteMember = async (email: string, role: string): Promise<void> => {
    if (!currentOrganization) throw new Error("No organization selected");

    const response = await apiClient.inviteMember(
      currentOrganization.id,
      email,
      role
    );
    if (!response.success) {
      throw new Error(response.error || "Failed to invite member");
    }
  };

  // Load organizations when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      refreshOrganizations();
    } else {
      // Clear organization data when not authenticated
      setCurrentOrganization(null);
      setOrganizations([]);
      setMembers([]);
      setStats(null);
      // Clear localStorage to prevent cross-user contamination
      localStorage.removeItem("lastSelectedOrganizationId");
    }
  }, [isAuthenticated, user?.id, refreshOrganizations]);

  // Load members and stats when current organization changes
  useEffect(() => {
    if (currentOrganization) {
      refreshMembers();
      // refreshStats();
    }
  }, [currentOrganization, refreshMembers]);

  const value = {
    // Current organization
    currentOrganization,

    // Organization list
    organizations,
    isLoadingOrganizations,
    refreshOrganizations,

    // Organization members
    members,
    isLoadingMembers,
    refreshMembers,

    // Organization stats
    stats,
    isLoadingStats,
    refreshStats,

    // Organization management
    createOrganization,
    updateOrganization,
    deleteOrganization,

    // Member management
    updateMemberRole,
    removeMember,

    // Invitation management
    inviteMember,

    // Organization switching
    switchOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider"
    );
  }
  return context;
}

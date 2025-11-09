"use client";

import React, { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { canPerformAdminActions } from "@/utils/roleUtils";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  allowedRoles?: string[]; // e.g., ["admin", "reviewer"]
  requireAdmin?: boolean; // Shortcut for requireAuth + admin only
}

export default function ProtectedRoute({
  children,
  requireAuth = true,
  redirectTo = "/login",
  allowedRoles,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading) {
      if (requireAuth && !isAuthenticated) {
        router.push(redirectTo);
        return;
      }

      // Check role-based access
      if (requireAuth && isAuthenticated) {
        if (requireAdmin && !canPerformAdminActions(user)) {
          router.push("/");
          return;
        }

        if (allowedRoles && user && !allowedRoles.includes(user.role)) {
          router.push("/");
          return;
        }
      }

      if (!requireAuth && isAuthenticated) {
        router.push("/");
      }
    }
  }, [isAuthenticated, isLoading, requireAuth, redirectTo, router, allowedRoles, requireAdmin, user]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render children if authentication state doesn't match requirements
  if (requireAuth && !isAuthenticated) {
    return null;
  }

  if (!requireAuth && isAuthenticated) {
    return null;
  }

  // Check role-based access
  if (requireAuth && isAuthenticated) {
    if (requireAdmin && !canPerformAdminActions(user)) {
      return null;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      return null;
    }
  }

  return <>{children}</>;
}

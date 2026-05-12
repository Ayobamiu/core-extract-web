"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Empty } from "antd";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SidebarLayout from "@/components/layout/SidebarLayout";
import SchemaRegistryAdmin from "@/components/registry/SchemaRegistryAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { canPerformAdminActions } from "@/utils/roleUtils";

export default function RegistryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = canPerformAdminActions(user);

  useEffect(() => {
    if (!isAdmin && user) {
      router.replace("/");
    }
  }, [isAdmin, user, router]);

  if (!user) {
    return (
      <ProtectedRoute>
        <SidebarLayout pageTitle="Schema registry">
          <Empty description="Loading…" />
        </SidebarLayout>
      </ProtectedRoute>
    );
  }

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <SidebarLayout pageTitle="Schema registry">
          <Card>
            <Empty description="Admins only." />
          </Card>
        </SidebarLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SidebarLayout
        pageTitle="Schema registry"
        pageDescription="Document types, schemas, and classifier hints"
      >
        <SchemaRegistryAdmin />
      </SidebarLayout>
    </ProtectedRoute>
  );
}

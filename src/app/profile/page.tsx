"use client";

import React from "react";
import { Card, Typography } from "antd";
import SidebarLayout from "@/components/layout/SidebarLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import UserProfile from "@/components/auth/UserProfile";

const { Title, Text } = Typography;

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <SidebarLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <Title level={2} className="!mb-2">
              Profile
            </Title>
            <Text type="secondary">
              Manage your account settings and preferences
            </Text>
          </div>
          <Card>
            <UserProfile />
          </Card>
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}

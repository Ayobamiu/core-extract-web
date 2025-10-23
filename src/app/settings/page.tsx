"use client";

import React from "react";
import {
  Card,
  Typography,
  Button,
  Switch,
  Input,
  Form,
  Divider,
  Space,
} from "antd";
import { Save, Bell, Shield, Palette, Globe } from "lucide-react";
import SidebarLayout from "@/components/layout/SidebarLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

const { Title, Text } = Typography;

export default function SettingsPage() {
  const { user } = useAuth();

  const onFinish = (values: any) => {
    console.log("Settings updated:", values);
  };

  return (
    <ProtectedRoute>
      <SidebarLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <Title level={2} className="!mb-2">
              Settings
            </Title>
            <Text type="secondary">
              Configure your account preferences and system settings
            </Text>
          </div>

          <Form
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
              notifications: true,
              emailUpdates: true,
              darkMode: false,
            }}
          >
            {/* Account Settings */}
            <Card>
              <div className="mb-4">
                <Title level={4} className="!mb-2 flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Account Settings
                </Title>
                <Text type="secondary">
                  Manage your account information and security preferences
                </Text>
              </div>

              <Form.Item label="Email" name="email">
                <Input value={user?.email} disabled />
              </Form.Item>

              <Form.Item label="Full Name" name="name">
                <Input value={user?.name} />
              </Form.Item>
            </Card>

            {/* Notification Settings */}
            <Card>
              <div className="mb-4">
                <Title level={4} className="!mb-2 flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Notifications
                </Title>
                <Text type="secondary">
                  Choose how you want to be notified about system events
                </Text>
              </div>

              <Form.Item
                label="Enable Notifications"
                name="notifications"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="Email Updates"
                name="emailUpdates"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Card>

            {/* Appearance Settings */}
            <Card>
              <div className="mb-4">
                <Title level={4} className="!mb-2 flex items-center">
                  <Palette className="w-5 h-5 mr-2" />
                  Appearance
                </Title>
                <Text type="secondary">
                  Customize the look and feel of your dashboard
                </Text>
              </div>

              <Form.Item
                label="Dark Mode"
                name="darkMode"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Card>

            {/* System Settings */}
            <Card>
              <div className="mb-4">
                <Title level={4} className="!mb-2 flex items-center">
                  <Globe className="w-5 h-5 mr-2" />
                  System Settings
                </Title>
                <Text type="secondary">
                  Configure system-wide preferences and behavior
                </Text>
              </div>

              <Form.Item label="Auto-refresh Interval" name="refreshInterval">
                <Input placeholder="5 seconds" />
              </Form.Item>

              <Form.Item
                label="Default Extraction Method"
                name="extractionMethod"
              >
                <Input placeholder="documentai" />
              </Form.Item>
            </Card>

            <Card>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<Save className="w-4 h-4" />}
                >
                  Save Settings
                </Button>
                <Button>Reset to Defaults</Button>
              </Space>
            </Card>
          </Form>
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}

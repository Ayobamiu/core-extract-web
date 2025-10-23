"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Typography } from "antd";
import { ArrowLeft } from "lucide-react";

const { Title, Text } = Typography;

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <Title level={1} className="!mb-2">
            Core Extract
          </Title>
          <Text type="secondary">Registration Unavailable</Text>
        </div>

        {/* Deactivated Message */}
        <Card>
          <div className="text-center">
            <div className="text-yellow-600 text-6xl mb-4">⚠️</div>
            <Title level={3} className="!mb-4">
              Registration Disabled
            </Title>
            <Text className="mb-6 block">
              User registration is currently disabled. Please contact your
              administrator to request access to the system.
            </Text>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <Title level={5} className="!mb-2 text-blue-800">
                Need Access?
              </Title>
              <Text className="text-xs text-blue-700">
                Contact your system administrator to create an account for you.
              </Text>
            </div>

            <Button
              type="primary"
              size="large"
              block
              onClick={() => router.push("/login")}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Login
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

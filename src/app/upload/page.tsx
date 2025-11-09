"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Typography, Button, Empty } from "antd";
import { Upload, Building2 } from "lucide-react";
import FileUpload from "@/components/dashboard/FileUpload";
import SidebarLayout from "@/components/layout/SidebarLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { canPerformAdminActions } from "@/utils/roleUtils";

const { Title, Text } = Typography;

export default function UploadPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const isAdmin = canPerformAdminActions(user);

  // Redirect reviewers
  useEffect(() => {
    if (!isAdmin && user) {
      router.push("/");
    }
  }, [isAdmin, user, router]);

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <SidebarLayout>
          <Card>
            <Empty
              description="Access Denied"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Text type="secondary">
                Only administrators can create new jobs.
              </Text>
            </Empty>
          </Card>
        </SidebarLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireAdmin={true}>
      <SidebarLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <Title level={2} className="!mb-2">
              Upload Documents
            </Title>
            <Text type="secondary">
              Upload PDF files and define extraction schema for AI-powered
              document processing
            </Text>
          </div>

          {/* Check if user has an organization */}
          {!currentOrganization ? (
            <Card>
              <Empty
                description="No Organization Selected"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <div className="text-center">
                  <p className="text-gray-600 mb-4">
                    You need to be part of an organization to upload files and
                    create jobs.
                  </p>
                  <Button
                    type="primary"
                    icon={<Building2 className="w-4 h-4" />}
                  >
                    Create Organization
                  </Button>
                </div>
              </Empty>
            </Card>
          ) : (
            <>
              {/* Upload Instructions */}
              <Card>
                <div className="mb-4">
                  <Title level={4} className="!mb-2">
                    How to Upload Documents
                  </Title>
                  <Text type="secondary">
                    Follow these steps to process your documents with AI
                  </Text>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-blue-600 font-semibold text-lg">
                        1
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Upload PDF
                    </h3>
                    <p className="text-sm text-gray-600">
                      Drag and drop or select PDF files to upload
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-green-600 font-semibold text-lg">
                        2
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Define Schema
                    </h3>
                    <p className="text-sm text-gray-600">
                      Provide a JSON schema describing the data you want to
                      extract
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-purple-600 font-semibold text-lg">
                        3
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Get Results
                    </h3>
                    <p className="text-sm text-gray-600">
                      View and download structured data from your documents
                    </p>
                  </div>
                </div>
              </Card>

              {/* File Upload Component */}
              <Card>
                <div className="mb-4">
                  <Title level={4} className="!mb-2">
                    Upload Files
                  </Title>
                  <Text type="secondary">
                    Select files to process with AI-powered document extraction
                  </Text>
                </div>
                <FileUpload
                  onUploadSuccess={(jobId) => {
                    router.push(`/jobs/${jobId}`);
                  }}
                />
              </Card>
            </>
          )}
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}

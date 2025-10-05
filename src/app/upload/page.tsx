"use client";

import React from "react";
import { useRouter } from "next/navigation";
import FileUpload from "@/components/dashboard/FileUpload";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Navigation from "@/components/layout/Navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function UploadPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navigation />

        {/* Main Content */}
        <main className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Check if user has an organization */}
            {!currentOrganization ? (
              <div className="text-center py-12">
                <Card className="p-8 max-w-md mx-auto">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Organization Selected
                  </h3>
                  <p className="text-gray-600 mb-6">
                    You need to be part of an organization to upload files and
                    create jobs.
                  </p>
                  <Button onClick={() => router.push("/")} className="w-full">
                    Go to Dashboard
                  </Button>
                </Card>
              </div>
            ) : (
              <>
                {/* Page Header */}
                <div className="mb-6">
                  <div className="flex items-center space-x-4 mb-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push("/")}
                    >
                      ← Back to Dashboard
                    </Button>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Upload Documents
                  </h1>
                  <p className="text-gray-600">
                    {currentOrganization
                      ? `Upload PDF files and define extraction schema for ${currentOrganization.name}`
                      : "Upload PDF files and define extraction schema"}
                  </p>
                </div>

                {/* Upload Instructions */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>How to Upload Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>

                {/* File Upload Component */}
                <FileUpload
                  onUploadSuccess={(jobId) => {
                    router.push(`/jobs/${jobId}`);
                  }}
                />
              </>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import FileUpload from "@/components/dashboard/FileUpload";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Navigation from "@/components/layout/Navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function UploadPage() {
  const router = useRouter();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navigation />

        {/* Main Content */}
        <main className="p-6">
          <div className="max-w-4xl mx-auto">
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
                Upload PDF files and define extraction schema
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
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

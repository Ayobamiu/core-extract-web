"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Core Extract
          </h1>
          <p className="text-gray-600">Registration Unavailable</p>
        </div>

        {/* Deactivated Message */}
        <Card className="p-8">
          <div className="text-center">
            <div className="text-yellow-600 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Registration Disabled
            </h2>
            <p className="text-gray-600 mb-6">
              User registration is currently disabled. Please contact your
              administrator to request access to the system.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <h3 className="text-sm font-medium text-blue-800 mb-2">
                Need Access?
              </h3>
              <p className="text-xs text-blue-700">
                Contact your system administrator to create an account for you.
              </p>
            </div>

            <Button
              onClick={() => router.push("/login")}
              variant="primary"
              className="w-full"
            >
              <ChevronLeftIcon className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import Navigation from "@/components/layout/Navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import UserProfile from "@/components/auth/UserProfile";

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="p-6">
          <UserProfile />
        </main>
      </div>
    </ProtectedRoute>
  );
}

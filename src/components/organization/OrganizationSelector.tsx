"use client";

import React, { useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

interface OrganizationSelectorProps {
  className?: string;
  onCreateOrganization?: () => void;
}

export default function OrganizationSelector({
  className = "",
  onCreateOrganization,
}: OrganizationSelectorProps) {
  const {
    currentOrganization,
    organizations,
    switchOrganization,
    isLoadingOrganizations,
  } = useOrganization();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoadingOrganizations) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-10 bg-gray-200 rounded-md w-48"></div>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className={className}>
        <Card className="p-4 border-dashed border-2 border-gray-300">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Organization
            </h3>
            <p className="text-gray-600 mb-4">
              You need to be part of an organization to access jobs and files.
            </p>
            <Button variant="primary" onClick={onCreateOrganization}>
              Create Organization
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative">
        <Button
          variant="secondary"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full justify-between"
        >
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="truncate">
              {currentOrganization?.name || "Select Organization"}
            </span>
          </div>
          <svg
            className={`w-4 h-4 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </Button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <div className="py-1">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    switchOrganization(org.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-2 ${
                    currentOrganization?.id === org.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700"
                  }`}
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="truncate">{org.name}</span>
                  {currentOrganization?.id === org.id && (
                    <svg
                      className="w-4 h-4 text-blue-600 ml-auto"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}

              <div className="border-t border-gray-200 mt-1 pt-1">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onCreateOrganization?.();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-600 flex items-center space-x-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  <span>Create New Organization</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

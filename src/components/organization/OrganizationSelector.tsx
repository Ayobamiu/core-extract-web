"use client";

import React, { useEffect, useRef, useState } from "react";
import { Building2 } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { canPerformAdminActions } from "@/utils/roleUtils";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

interface OrganizationSelectorProps {
  className?: string;
  onCreateOrganization?: () => void;
  /** Icon-only control for narrow / collapsed sidebars — same org list + create (admins). */
  compact?: boolean;
}

export default function OrganizationSelector({
  className = "",
  onCreateOrganization,
  compact = false,
}: OrganizationSelectorProps) {
  const {
    currentOrganization,
    organizations,
    switchOrganization,
    isLoadingOrganizations,
  } = useOrganization();
  const { user } = useAuth();
  const isAdmin = canPerformAdminActions(user);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  if (isLoadingOrganizations) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div
          className={`h-10 bg-gray-200 rounded-md ${compact ? "w-10 mx-auto" : "w-48"}`}
        />
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
            {isAdmin && (
              <Button variant="primary" onClick={onCreateOrganization}>
                Create Organization
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (compact) {
    return (
      <div ref={rootRef} className={`relative flex justify-center ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          title={currentOrganization?.name || "Organization"}
          aria-label={`Organization: ${currentOrganization?.name || "Select"}. ${isOpen ? "Close menu" : "Open menu"}`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <Building2 className="h-5 w-5" aria-hidden />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-green-500 ring-2 ring-white" />
        </button>

        {isOpen && (
          <div
            className="absolute top-0 left-full ml-2 min-w-[14rem] max-w-[min(20rem,calc(100vw-5rem))] bg-white border border-gray-200 rounded-md shadow-lg z-[60] py-1"
            role="listbox"
            aria-label="Organizations"
          >
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Organization
              </p>
              <p className="text-sm font-medium text-gray-900 truncate">
                {currentOrganization?.name}
              </p>
            </div>
            <div className="py-1 max-h-64 overflow-y-auto">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  role="option"
                  aria-selected={currentOrganization?.id === org.id}
                  onClick={() => {
                    switchOrganization(org.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${
                    currentOrganization?.id === org.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700"
                  }`}
                >
                  <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                  <span className="truncate">{org.name}</span>
                  {currentOrganization?.id === org.id && (
                    <svg
                      className="w-4 h-4 text-blue-600 ml-auto flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden
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
            </div>
            {isAdmin && (
              <div className="border-t border-gray-200 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onCreateOrganization?.();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-600 flex items-center gap-2 text-sm"
                >
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  <span>Create organization</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={className}>
      <div className="relative">
        <Button
          variant="secondary"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full justify-between"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label="Select organization"
        >
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
            <span className="truncate">
              {currentOrganization?.name || "Select Organization"}
            </span>
          </div>
          <svg
            className={`w-4 h-4 transition-transform flex-shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
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
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50"
            role="listbox"
            aria-label="Organizations"
          >
            <div className="py-1">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
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

              {isAdmin && (
                <div className="border-t border-gray-200 mt-1 pt-1">
                  <button
                    type="button"
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

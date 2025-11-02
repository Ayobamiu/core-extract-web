"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  User,
  Building2,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  Upload,
  BarChart3,
} from "lucide-react";
import OrganizationSelector from "@/components/organization/OrganizationSelector";
import CreateOrganizationModal from "@/components/organization/CreateOrganizationModal";

interface SidebarLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  headerActions?: React.ReactNode; // Custom header actions (right side)
  headerContent?: React.ReactNode; // Custom header content (left side, replaces pageTitle)
}

const navigationItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    description: "Overview and analytics",
  },
  {
    name: "Files",
    href: "/files",
    icon: FileText,
    description: "Manage your files",
  },
  {
    name: "Jobs",
    href: "/jobs",
    icon: Briefcase,
    description: "Processing jobs",
  },
  {
    name: "Upload",
    href: "/upload",
    icon: Upload,
    description: "Upload new files",
  },
];

export default function SidebarLayout({
  children,
  pageTitle,
  pageDescription,
  headerActions,
  headerContent,
}: SidebarLayoutProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const { currentOrganization } = useOrganization();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Start with sidebar open
  const [isCollapsed, setIsCollapsed] = useState(false); // Collapsed state for desktop
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true); // Assume desktop initially

  // Load collapse state from localStorage
  useEffect(() => {
    const savedCollapseState = localStorage.getItem("sidebarCollapsed");
    if (savedCollapseState !== null) {
      setIsCollapsed(savedCollapseState === "true");
    }
  }, []);

  useEffect(() => {
    const checkScreenSize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (desktop) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const toggleCollapse = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    localStorage.setItem("sidebarCollapsed", String(newCollapsedState));
  };

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex layout-container">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
              onClick={closeSidebar}
            />
          </>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{
          x: isDesktop ? 0 : isSidebarOpen ? 0 : "-100%",
          width:
            isDesktop && isCollapsed ? "4rem" : isDesktop ? "18rem" : "18rem",
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 lg:relative lg:translate-x-0 lg:block lg:h-screen sidebar-desktop ${
          isDesktop && isCollapsed ? "w-16" : "w-72"
        }`}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* Logo */}
          <div
            className={`flex h-16 items-center justify-between border-b border-gray-200 flex-shrink-0 ${
              isDesktop && isCollapsed ? "px-3 justify-center" : "px-6"
            }`}
          >
            <Link
              href="/"
              className={`flex items-center ${
                isDesktop && isCollapsed ? "justify-center" : "space-x-3"
              }`}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">CE</span>
              </div>
              {(!isDesktop || !isCollapsed) && (
                <div>
                  <span className="text-lg font-bold text-gray-900">
                    Core Extract
                  </span>
                  <div className="text-xs text-gray-500">
                    Document AI Platform
                  </div>
                </div>
              )}
            </Link>
            <div className="flex items-center space-x-1">
              {isDesktop && (
                <button
                  onClick={toggleCollapse}
                  className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                  title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronLeft className="h-5 w-5 text-gray-500" />
                  )}
                </button>
              )}
              <button
                onClick={closeSidebar}
                className="lg:hidden p-1 rounded-md hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Organization Selector */}
          {(!isDesktop || !isCollapsed) && (
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="mb-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </label>
              </div>
              <OrganizationSelector
                onCreateOrganization={() => setIsCreateOrgModalOpen(true)}
              />
            </div>
          )}
          {isDesktop && isCollapsed && (
            <div className="px-3 py-4 border-b border-gray-200 flex-shrink-0 flex justify-center">
              <button
                onClick={() => setIsCreateOrgModalOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                title="Organization"
              >
                <Building2 className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          )}

          {/* Navigation */}
          <nav
            className={`flex-1 py-6 space-y-1 overflow-y-auto ${
              isDesktop && isCollapsed ? "px-2" : "px-4"
            }`}
          >
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`group flex items-center text-sm font-medium rounded-lg transition-all duration-200 ${
                    isDesktop && isCollapsed
                      ? "justify-center px-2 py-3"
                      : "px-3 py-2.5"
                  } ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                  title={isDesktop && isCollapsed ? item.name : undefined}
                >
                  <Icon
                    className={`h-5 w-5 transition-colors flex-shrink-0 ${
                      isDesktop && isCollapsed ? "" : "mr-3"
                    } ${
                      isActive
                        ? "text-blue-600"
                        : "text-gray-400 group-hover:text-gray-600"
                    }`}
                  />
                  {(!isDesktop || !isCollapsed) && (
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        {item.description}
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div
            className={`border-t border-gray-200 flex-shrink-0 ${
              isDesktop && isCollapsed ? "p-2" : "p-4"
            }`}
          >
            {isDesktop && isCollapsed ? (
              <div className="flex flex-col items-center space-y-2">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity"
                  title={user?.name || "User"}
                >
                  <span className="text-white font-medium text-sm">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </button>
                {/* User Menu Dropdown for collapsed state */}
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute left-full bottom-4 ml-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50"
                    >
                      <Link
                        href="/profile"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                      >
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                      <hr className="my-1" />
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 whitespace-nowrap"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex w-full items-center justify-between rounded-lg p-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {user?.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium text-gray-900">
                        {user?.name}
                      </div>
                      <div className="text-xs text-gray-500">{user?.email}</div>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${
                      isUserMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* User Menu Dropdown */}
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
                    >
                      <Link
                        href="/profile"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                      <hr className="my-1" />
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen main-content">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between bg-white border-b border-gray-200 px-6">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>

          <div className="flex items-center space-x-4 flex-1">
            {/* Breadcrumb or page title can go here */}
            {headerContent ? (
              headerContent
            ) : (
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-gray-900">
                  {pageTitle ||
                    navigationItems.find((item) => item.href === pathname)
                      ?.name ||
                    "Dashboard"}
                </h1>
                {pageDescription && (
                  <p className="text-sm text-gray-500">{pageDescription}</p>
                )}
              </div>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {headerActions || (
              <>
                {/* Status indicators or notifications can go here */}
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm text-gray-500">System Online</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        isOpen={isCreateOrgModalOpen}
        onClose={() => setIsCreateOrgModalOpen(false)}
      />
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { canPerformAdminActions } from "@/utils/roleUtils";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  Upload,
  Library,
  Building2,
} from "lucide-react";
import OrganizationSelector from "@/components/organization/OrganizationSelector";
import CreateOrganizationModal from "@/components/organization/CreateOrganizationModal";

interface SidebarLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  headerActions?: React.ReactNode;
  headerContent?: React.ReactNode;
}

const mainNavigationItems = [
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

/** Shown in an “Admin” group for admin JWTs only. */
const adminRegistryNavItem = {
  name: "Schema registry",
  href: "/registry",
  icon: Library,
  description: "Document types & schemas",
};

export default function SidebarLayout({
  children,
  pageTitle,
  pageDescription,
  headerActions,
  headerContent,
}: SidebarLayoutProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const { currentOrganization } = useOrganization();
  const isAdmin = canPerformAdminActions(user);
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const el = userMenuRef.current;
      if (el && !el.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!isSidebarOpen || isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isSidebarOpen, isDesktop]);

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

  const navLinkIsActive = (href: string) =>
    href !== "/"
      ? pathname === href || pathname?.startsWith(href + "/")
      : pathname === href;

  const renderNavLink = (item: (typeof mainNavigationItems)[0]) => {
    const isActive = navLinkIsActive(item.href);
    const Icon = item.icon;
    const collapsed = isDesktop && isCollapsed;

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={closeSidebar}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? item.name : undefined}
        className={`group flex items-center text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
          collapsed ? "justify-center px-2 py-3" : "px-3 py-2.5"
        } ${
          isActive
            ? "bg-blue-50 text-blue-800 border border-blue-200 shadow-sm"
            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 border border-transparent"
        }`}
      >
        <Icon
          className={`h-5 w-5 transition-colors flex-shrink-0 ${
            collapsed ? "" : "mr-3"
          } ${
            isActive
              ? "text-blue-600"
              : "text-gray-400 group-hover:text-gray-600"
          }`}
          aria-hidden
        />
        {(!isDesktop || !isCollapsed) && (
          <div className="flex-1 min-w-0">
            <div className="font-medium">{item.name}</div>
            <div className="text-xs text-gray-500 line-clamp-2">
              {item.description}
            </div>
          </div>
        )}
      </Link>
    );
  };

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex layout-container">
      <AnimatePresence>
        {isSidebarOpen && !isDesktop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={closeSidebar}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <motion.aside
        id="app-sidebar"
        initial={false}
        animate={{
          x: isDesktop ? 0 : isSidebarOpen ? 0 : "-100%",
          width:
            isDesktop && isCollapsed ? "4rem" : isDesktop ? "18rem" : "18rem",
        }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 shadow-sm lg:relative lg:translate-x-0 lg:block lg:h-screen lg:shadow-none sidebar-desktop ${
          isDesktop && isCollapsed ? "w-16" : "w-72"
        }`}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div
            className={`flex h-16 items-center justify-between border-b border-gray-200 flex-shrink-0 gap-2 ${
              isDesktop && isCollapsed ? "px-2" : "pl-4 pr-3"
            }`}
          >
            <Link
              href="/"
              onClick={closeSidebar}
              className={`flex items-center min-w-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                isDesktop && isCollapsed ? "justify-center p-1.5" : "space-x-3 py-1"
              }`}
              aria-label="Core Extract — Home"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white font-bold text-sm">CE</span>
              </div>
              {(!isDesktop || !isCollapsed) && (
                <div className="min-w-0">
                  <span className="text-lg font-bold text-gray-900 truncate block">
                    Core Extract
                  </span>
                  <div className="text-xs text-gray-500 truncate">
                    Document AI Platform
                  </div>
                </div>
              )}
            </Link>
            <div className="flex items-center flex-shrink-0 gap-0.5">
              {isDesktop && (
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
                  title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-expanded={!isCollapsed}
                  aria-controls="app-sidebar"
                  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-5 w-5" />
                  ) : (
                    <ChevronLeft className="h-5 w-5" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={closeSidebar}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className={`border-b border-gray-200 flex-shrink-0 ${
              isDesktop && isCollapsed ? "px-2 py-3 flex justify-center" : "px-4 py-3"
            }`}
          >
            {isDesktop && isCollapsed ? (
              <OrganizationSelector
                compact
                onCreateOrganization={
                  isAdmin ? () => setIsCreateOrgModalOpen(true) : undefined
                }
              />
            ) : (
              <>
                <div className="mb-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </label>
                </div>
                <OrganizationSelector
                  onCreateOrganization={
                    isAdmin ? () => setIsCreateOrgModalOpen(true) : undefined
                  }
                />
              </>
            )}
          </div>

          <nav
            className={`flex-1 py-4 space-y-4 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:rgb(203_213_225)_transparent] ${
              isDesktop && isCollapsed ? "px-2" : "px-3"
            }`}
            aria-label="Main navigation"
          >
            <div className="space-y-1">
              {(!isDesktop || !isCollapsed) && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Navigate
                </p>
              )}
              {mainNavigationItems.map(renderNavLink)}
            </div>

            {isAdmin && (
              <div className="space-y-1 pt-2 border-t border-gray-100">
                {(!isDesktop || !isCollapsed) && (
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Admin
                  </p>
                )}
                {(() => {
                  const item = adminRegistryNavItem;
                  const isActive = navLinkIsActive(item.href);
                  const Icon = item.icon;
                  const collapsed = isDesktop && isCollapsed;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={closeSidebar}
                      aria-current={isActive ? "page" : undefined}
                      title={collapsed ? item.name : undefined}
                      className={`group flex items-center text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                        collapsed ? "justify-center px-2 py-3" : "px-3 py-2.5"
                      } ${
                        isActive
                          ? "bg-violet-50 text-violet-900 border border-violet-200 shadow-sm"
                          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 border border-transparent"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 flex-shrink-0 ${
                          collapsed ? "" : "mr-3"
                        } ${
                          isActive
                            ? "text-violet-600"
                            : "text-gray-400 group-hover:text-gray-600"
                        }`}
                        aria-hidden
                      />
                      {(!isDesktop || !isCollapsed) && (
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-gray-500 line-clamp-2">
                            {item.description}
                          </div>
                        </div>
                      )}
                    </Link>
                  );
                })()}
              </div>
            )}
          </nav>

          <div
            ref={userMenuRef}
            className={`border-t border-gray-200 flex-shrink-0 relative ${
              isDesktop && isCollapsed ? "p-2" : "p-3"
            }`}
          >
            {isDesktop && isCollapsed ? (
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  title={user?.name || "Account menu"}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  aria-label="Account menu"
                >
                  <span className="text-white font-medium text-sm">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </button>
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute left-full bottom-0 ml-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[55] min-w-[11rem]"
                      role="menu"
                    >
                      <Link
                        href="/profile"
                        role="menuitem"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                      >
                        <User className="mr-2 h-4 w-4" aria-hidden />
                        Profile
                      </Link>
                      <Link
                        href="/settings"
                        role="menuitem"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                      >
                        <Settings className="mr-2 h-4 w-4" aria-hidden />
                        Settings
                      </Link>
                      <hr className="my-1 border-gray-100" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 whitespace-nowrap"
                      >
                        <LogOut className="mr-2 h-4 w-4" aria-hidden />
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex w-full items-center justify-between rounded-lg p-2 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  aria-label="Account menu"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-medium text-sm">
                        {user?.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {user?.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate max-w-[12rem]">
                        {user?.email}
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${
                      isUserMenuOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  />
                </button>

                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[55]"
                      role="menu"
                    >
                      <Link
                        href="/profile"
                        role="menuitem"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <User className="mr-2 h-4 w-4" aria-hidden />
                        Profile
                      </Link>
                      <Link
                        href="/settings"
                        role="menuitem"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Settings className="mr-2 h-4 w-4" aria-hidden />
                        Settings
                      </Link>
                      <hr className="my-1 border-gray-100" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="mr-2 h-4 w-4" aria-hidden />
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      <div className="flex-1 flex flex-col min-h-screen min-w-0 main-content">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 sm:px-6 supports-[backdrop-filter]:bg-white/85">
          <button
            type="button"
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Open navigation menu"
            aria-expanded={isSidebarOpen}
            aria-controls="app-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center min-w-0 flex-1">
            {headerContent ? (
              headerContent
            ) : (
              <div className="min-w-0 hidden sm:block">
                <h1 className="text-lg font-semibold text-gray-900 truncate">
                  {pageTitle ||
                    mainNavigationItems.find((item) => item.href === pathname)
                      ?.name ||
                    "Dashboard"}
                </h1>
                {pageDescription && (
                  <p className="text-sm text-gray-500 line-clamp-1">
                    {pageDescription}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {headerActions ||
              (currentOrganization && (
                <div
                  className="hidden sm:flex items-center gap-2 max-w-[14rem] xl:max-w-xs rounded-full border border-gray-200 bg-gray-50/80 px-3 py-1.5"
                  title={currentOrganization.name}
                >
                  <Building2
                    className="h-4 w-4 text-gray-500 flex-shrink-0"
                    aria-hidden
                  />
                  <span className="text-sm text-gray-700 truncate">
                    {currentOrganization.name}
                  </span>
                </div>
              ))}
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>

      <CreateOrganizationModal
        isOpen={isCreateOrgModalOpen}
        onClose={() => setIsCreateOrgModalOpen(false)}
      />
    </div>
  );
}

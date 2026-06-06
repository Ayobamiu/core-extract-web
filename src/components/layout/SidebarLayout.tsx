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
  Settings,
  Upload,
  Library,
  Building2,
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
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

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
};

const mainNavigationItems: NavItem[] = [
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

const adminNavItems: NavItem[] = [
  {
    name: "Schema registry",
    href: "/registry",
    icon: Library,
    description: "Document types & schemas",
  },
  {
    name: "Monitoring",
    href: "/monitoring",
    icon: Activity,
    description: "Section health & guardrails",
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
  const isAdmin = canPerformAdminActions(user);
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const resolvedPageTitle =
    pageTitle ||
    mainNavigationItems.find((item) => item.href === pathname)?.name ||
    adminNavItems.find((item) =>
      item.href !== "/"
        ? pathname === item.href || pathname?.startsWith(item.href + "/")
        : pathname === item.href,
    )?.name;

  useEffect(() => {
    document.title = resolvedPageTitle ?? "Core Extract";
  }, [resolvedPageTitle]);

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

  const sidebarCollapsed = isDesktop && isCollapsed;

  const renderNavLink = (item: NavItem) => {
    const isActive = navLinkIsActive(item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={closeSidebar}
        aria-current={isActive ? "page" : undefined}
        title={sidebarCollapsed ? item.name : item.description}
        className={`group flex items-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
          sidebarCollapsed
            ? "justify-center p-2"
            : "gap-2 px-2 py-1.5 text-[13px]"
        } ${
          isActive
            ? "bg-zinc-800 text-zinc-100"
            : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
        }`}
      >
        <Icon
          className={`h-4 w-4 flex-shrink-0 ${
            isActive
              ? "text-emerald-400"
              : "text-zinc-500 group-hover:text-zinc-300"
          }`}
          aria-hidden
        />
        {!sidebarCollapsed && (
          <span className="truncate font-medium">{item.name}</span>
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
        }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className={`fixed inset-y-0 left-0 z-50 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 lg:relative lg:translate-x-0 lg:block lg:h-screen sidebar-desktop transition-[width] duration-200 ease-out ${
          sidebarCollapsed ? "w-12" : "w-[13.5rem]"
        } ${!isDesktop ? "w-[13.5rem]" : ""}`}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* Brand + collapse */}
          <div
            className={`flex h-11 shrink-0 items-center overflow-hidden border-b border-zinc-800/80 ${
              sidebarCollapsed ? "justify-center px-1.5" : "px-2 gap-1"
            }`}
          >
            {sidebarCollapsed ? (
              <Link
                href="/"
                onClick={closeSidebar}
                className="flex items-center justify-center p-2 rounded-md hover:bg-zinc-800/70 transition-colors"
                aria-label="Core Extract — Home"
              >
                <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center flex-shrink-0">
                  <Layers className="h-3.5 w-3.5 text-white" aria-hidden />
                </div>
              </Link>
            ) : (
              <>
                <Link
                  href="/"
                  onClick={closeSidebar}
                  className="flex items-center gap-2 min-w-0 flex-1 rounded-md px-1 py-1 hover:bg-zinc-800/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  aria-label="Core Extract — Home"
                >
                  <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Layers className="h-3.5 w-3.5 text-white" aria-hidden />
                  </div>
                  <span className="text-xs font-semibold text-zinc-100 truncate">
                    Core Extract
                  </span>
                </Link>
                {isDesktop ? (
                  <button
                    type="button"
                    onClick={toggleCollapse}
                    className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex-shrink-0"
                    title="Collapse sidebar"
                    aria-expanded
                    aria-controls="app-sidebar"
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="h-4 w-4" aria-hidden />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeSidebar}
                    className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 lg:hidden"
                    aria-label="Close menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Organization */}
          <div
            className={`border-b border-zinc-800/80 flex-shrink-0 ${
              sidebarCollapsed
                ? "px-1.5 py-1.5 flex justify-center"
                : "px-2 py-2"
            }`}
          >
            <OrganizationSelector
              compact={sidebarCollapsed}
              tone="dark"
              className={sidebarCollapsed ? "w-full flex justify-center" : ""}
              onCreateOrganization={
                isAdmin ? () => setIsCreateOrgModalOpen(true) : undefined
              }
            />
          </div>

          <nav
            className={`flex-1 py-2 space-y-3 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:rgb(63_63_70)_transparent] ${
              sidebarCollapsed ? "px-1.5" : "px-2"
            }`}
            aria-label="Main navigation"
          >
            <div className="space-y-0.5">
              {!sidebarCollapsed && (
                <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Project
                </p>
              )}
              {mainNavigationItems.map(renderNavLink)}
            </div>

            {isAdmin && (
              <div className="space-y-0.5 pt-2 border-t border-zinc-800/80">
                {!sidebarCollapsed && (
                  <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Admin
                  </p>
                )}
                {adminNavItems.map(renderNavLink)}
              </div>
            )}
          </nav>

          {/* Account */}
          <div
            ref={userMenuRef}
            className={`border-t border-zinc-800/80 flex-shrink-0 relative ${
              sidebarCollapsed ? "p-1.5" : "p-2"
            }`}
          >
            {sidebarCollapsed ? (
              <div className="flex flex-col items-center gap-1">
                {isDesktop && (
                  <button
                    type="button"
                    onClick={toggleCollapse}
                    className="flex items-center justify-center p-2 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                    title="Expand sidebar"
                    aria-expanded={false}
                    aria-controls="app-sidebar"
                    aria-label="Expand sidebar"
                  >
                    <PanelLeftOpen className="h-4 w-4" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center justify-center p-2 rounded-md hover:bg-zinc-800/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  title={user?.name || "Account menu"}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  aria-label="Account menu"
                >
                  <span className="w-6 h-6 bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center text-zinc-200 font-medium text-xs">
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
                  className="flex w-full items-center justify-between rounded-md px-1.5 py-1.5 hover:bg-zinc-800/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  aria-label="Account menu"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center flex-shrink-0">
                      <span className="text-zinc-200 font-medium text-xs">
                        {user?.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-xs font-medium text-zinc-100 truncate">
                        {user?.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate max-w-[9rem]">
                        {user?.email}
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-zinc-500 flex-shrink-0 transition-transform ${
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
                      className="absolute bottom-full left-2 right-2 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[55]"
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
        <header className="sticky top-0 z-30 flex h-11 items-center justify-between gap-2 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-3 sm:px-4 supports-[backdrop-filter]:bg-white/85">
          <button
            type="button"
            onClick={toggleSidebar}
            className="lg:hidden p-1.5 rounded-md hover:bg-gray-100 text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            aria-label="Open navigation menu"
            aria-expanded={isSidebarOpen}
            aria-controls="app-sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex items-center min-w-0 flex-1">
            {headerContent ? (
              headerContent
            ) : (
              <div className="min-w-0 hidden sm:block">
                <h1 className="text-sm font-semibold text-gray-900 truncate leading-tight">
                  {pageTitle ||
                    mainNavigationItems.find((item) => item.href === pathname)
                      ?.name ||
                    "Dashboard"}
                </h1>
                {pageDescription && (
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {pageDescription}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {headerActions ||
              (currentOrganization && (
                <div
                  className="hidden sm:flex items-center gap-1.5 max-w-[12rem] xl:max-w-[16rem] rounded-md border border-gray-200 bg-gray-50/90 px-2 py-1"
                  title={currentOrganization.name}
                >
                  <Building2
                    className="h-3.5 w-3.5 text-gray-500 flex-shrink-0"
                    aria-hidden
                  />
                  <span className="text-xs text-gray-700 truncate">
                    {currentOrganization.name}
                  </span>
                </div>
              ))}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-5 overflow-y-auto">{children}</main>
      </div>

      <CreateOrganizationModal
        isOpen={isCreateOrgModalOpen}
        onClose={() => setIsCreateOrgModalOpen(false)}
      />
    </div>
  );
}

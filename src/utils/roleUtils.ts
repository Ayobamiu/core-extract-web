/**
 * Role utility functions for RBAC
 */

interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified?: boolean;
    createdAt?: string;
    lastLoginAt?: string;
    loginCount?: number;
}

/**
 * Check if user is an admin
 */
export const isAdmin = (user: User | null): boolean => {
    return user?.role === "admin";
};

/**
 * Check if user is a reviewer
 */
export const isReviewer = (user: User | null): boolean => {
    return user?.role === "reviewer";
};

/**
 * Check if user can edit (admin or reviewer)
 */
export const canEdit = (user: User | null): boolean => {
    return isAdmin(user) || isReviewer(user);
};

/**
 * Check if user can perform admin actions (only admin)
 */
export const canPerformAdminActions = (user: User | null): boolean => {
    return isAdmin(user);
};

/**
 * Check if user is a collaborator on a job
 */
export const isJobCollaborator = (
    user: User | null,
    job: { collaborators?: Array<{ email: string; role: string }> } | null
): boolean => {
    if (!user || !job || !job.collaborators) return false;
    return job.collaborators.some((collab) => collab.email === user.email);
};

/**
 * Check if user can access a job (admin or collaborator)
 */
export const canAccessJob = (
    user: User | null,
    job: { collaborators?: Array<{ email: string; role: string }> } | null
): boolean => {
    if (isAdmin(user)) return true; // Admins can access all jobs
    return isJobCollaborator(user, job);
};


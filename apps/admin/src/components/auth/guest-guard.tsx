'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';

import { paths } from '@/paths';
import { logger } from '@/lib/default-logger';
import { useUser } from '@/hooks/use-user';
import { Role } from '@/types/user';
import { authClient } from '@/lib/auth/client';

export interface GuestGuardProps {
  children: React.ReactNode;
}

export function GuestGuard({
  children,
}: GuestGuardProps): React.JSX.Element | null {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [isChecking, setIsChecking] = React.useState<boolean>(true);
  const [authError, setAuthError] = React.useState<string | null>(error);

  const checkPermissions = async (): Promise<void> => {
    if (isLoading) {
      return;
    }

    if (error) {
      setAuthError(error);
      setIsChecking(false);
      return;
    }

    if (user) {
      // Check if user has admin or super admin role
      const hasAdminRole = user.roles?.some(
        (role) => role === Role.Admin || role === Role.SuperAdmin,
      );

      if (!hasAdminRole) {
        logger.debug(
          '[GuestGuard]: User does not have admin privileges, signing out',
        );

        setAuthError("You don't have permission to access this dashboard");

        // Sign out the user since they don't have permission
        const { error: signOutError } = await authClient.signOut();
        if (signOutError) {
          logger.error('[GuestGuard]: Error signing out user:', signOutError);
        }

        setIsChecking(false);
        return;
      }

      logger.debug(
        '[GuestGuard]: Admin user is logged in, redirecting to dashboard',
      );
      router.replace(paths.dashboard.overview);
      return;
    }

    setAuthError(null);
    setIsChecking(false);
  };

  React.useEffect(() => {
    checkPermissions().catch(() => {
      // noop
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Expected
  }, [user, error, isLoading]);

  if (isChecking) {
    return null;
  }

  if (authError) {
    return <Alert color="error">{authError}</Alert>;
  }

  return <React.Fragment>{children}</React.Fragment>;
}

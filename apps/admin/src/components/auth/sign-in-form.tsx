'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import { Controller, useForm } from 'react-hook-form';
import { z as zod } from 'zod';

import { paths } from '@/paths';
import { authClient } from '@/lib/auth/client';
import { useUser } from '@/hooks/use-user';
import { PhoneInput } from './PhoneInput';
import { PinInput } from './PinInput';

const schema = zod.object({
  phone: zod.string().min(1, { message: 'Phone number is required' }),
  pin: zod
    .string()
    .min(6, { message: 'PIN is required (6 digits)' })
    .max(6, { message: 'PIN must be 6 digits' }),
});

type Values = zod.infer<typeof schema>;

const defaultValues = {
  phone: '+254',
  pin: '',
} satisfies Values;

export function SignInForm(): React.JSX.Element {
  const router = useRouter();

  const { checkSession } = useUser();

  const [isPending, setIsPending] = React.useState<boolean>(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({ defaultValues, resolver: zodResolver(schema) });

  const onSubmit = React.useCallback(
    async (values: Values): Promise<void> => {
      setIsPending(true);

      try {
        console.log('Attempting login with:', { phone: values.phone });
        const { data, error } = await authClient.signIn({
          phone: values.phone,
          pin: values.pin,
        });

        if (error) {
          const errorMessage =
            error.includes('not found') || error.includes('Invalid credentials')
              ? 'Invalid phone number or PIN. Please check your credentials and try again.'
              : error;

          setError('root', { type: 'server', message: errorMessage });
          setIsPending(false);
          return;
        }

        console.log('Login successful, checking roles:', data?.roles);

        // Check if the user has admin or super admin role
        if (data?.roles && data.roles.length > 0) {
          const hasAdminRole = data.roles.some(
            (role) => role === 1 || role === 3, // Role.Admin = 1, Role.SuperAdmin = 3
          );

          if (!hasAdminRole) {
            console.error('User does not have admin role');
            setError('root', {
              type: 'server',
              message:
                "You don't have permission to access this dashboard. Only administrators can log in.",
            });

            // Sign out the user since they don't have permission
            await authClient.signOut();
            setIsPending(false);
            return;
          }

          console.log('User has admin role, proceeding with authentication');
        } else {
          console.error('User has no roles defined');
        }

        // Refresh the auth state
        console.log('Refreshing auth state...');
        await checkSession?.();
        console.log('Auth state refreshed, redirecting to dashboard');

        // Explicitly redirect to dashboard after successful authentication
        router.push(paths.dashboard.overview);
      } catch (err) {
        console.error('Login error:', err);
        setError('root', {
          type: 'server',
          message: 'An unexpected error occurred. Please try again.',
        });
        setIsPending(false);
      }
    },
    [checkSession, router, setError],
  );

  return (
    <Stack spacing={4}>
      {/* <Stack spacing={1}>
        <Typography variant="h4">Sign in</Typography>
        <Typography color="text.secondary" variant="body2">
          Don&apos;t have an account?{" "}
          <Link
            component={RouterLink}
            href={paths.auth.signUp}
            underline="hover"
            variant="subtitle2"
          >
            Sign up
          </Link>
        </Typography>
      </Stack> */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={3}>
          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange, ...restField } }) => (
              <PhoneInput
                value={value || ''}
                onChange={onChange}
                label="PHONE NUMBER"
                error={errors.phone?.message}
                {...restField}
              />
            )}
          />
          <Controller
            control={control}
            name="pin"
            render={({ field: { value, onChange, ...restField } }) => (
              <PinInput
                value={value || ''}
                onChange={onChange}
                error={errors.pin?.message}
                label="PIN"
                {...restField}
              />
            )}
          />
          <div>
            <Link
              component={RouterLink}
              href={paths.auth.resetPassword}
              variant="subtitle2"
            >
              Forgot PIN?
            </Link>
          </div>
          {errors.root ? (
            <Alert color="error">{errors.root.message}</Alert>
          ) : null}
          <Button disabled={isPending} type="submit" variant="contained">
            Sign in
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}

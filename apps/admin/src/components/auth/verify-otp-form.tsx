'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Controller, useForm } from 'react-hook-form';
import { z as zod } from 'zod';

import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/use-user';
import { paths } from '@/paths';

interface VerifyOtpFormProps {
  phone?: string;
  npub?: string;
}

const schema = zod.object({
  otp: zod.string().min(1, { message: 'OTP code is required' }),
});

type Values = zod.infer<typeof schema>;

const defaultValues = { otp: '' } satisfies Values;

export function VerifyOtpForm({
  phone,
  npub,
}: VerifyOtpFormProps): React.JSX.Element {
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

      const { error } = await authClient.verify({
        phone,
        npub,
        otp: values.otp,
      });

      if (error) {
        setError('root', { type: 'server', message: error });
        setIsPending(false);
        return;
      }

      // Refresh the auth state
      await checkSession?.();

      // Redirect to dashboard
      router.push(paths.dashboard.overview);
    },
    [checkSession, phone, npub, router, setError],
  );

  return (
    <Stack spacing={4}>
      <Typography variant="h5">Verify your account</Typography>
      <Typography color="text.secondary" variant="body2">
        Enter the verification code sent to {phone || npub}
      </Typography>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <Controller
            control={control}
            name="otp"
            render={({ field }) => (
              <FormControl error={Boolean(errors.otp)}>
                <InputLabel>Verification Code</InputLabel>
                <OutlinedInput {...field} label="Verification Code" />
                {errors.otp ? (
                  <FormHelperText>{errors.otp.message}</FormHelperText>
                ) : null}
              </FormControl>
            )}
          />
          {errors.root ? (
            <Alert color="error">{errors.root.message}</Alert>
          ) : null}
          <Button disabled={isPending} type="submit" variant="contained">
            Verify
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}

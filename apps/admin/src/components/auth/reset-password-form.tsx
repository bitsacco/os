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
import { PhoneInput } from './PhoneInput';

const schema = zod
  .object({
    phone: zod.string().optional(),
    npub: zod.string().optional(),
  })
  .refine((data) => data.phone || data.npub, {
    message: 'Either phone number or Nostr public key is required',
    path: ['phone'],
  });

type Values = zod.infer<typeof schema>;

const defaultValues = { phone: '', npub: '' } satisfies Values;

export function ResetPasswordForm(): React.JSX.Element {
  const [isPending, setIsPending] = React.useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = React.useState<boolean>(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({ defaultValues, resolver: zodResolver(schema) });

  const onSubmit = React.useCallback(
    async (values: Values): Promise<void> => {
      setIsPending(true);

      const { error } = await authClient.recover({
        phone: values.phone || undefined,
        npub: values.npub || undefined,
      });

      if (error) {
        setError('root', { type: 'server', message: error });
        setIsPending(false);
        return;
      }

      setIsPending(false);
      setIsSubmitted(true);
    },
    [setError],
  );

  if (isSubmitted) {
    return (
      <Stack spacing={4}>
        <Typography variant="h5">Reset PIN Request Sent</Typography>
        <Alert severity="success">
          Recovery instructions have been sent to your phone or Nostr key.
          Please follow the instructions to reset your PIN.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={4}>
      <Typography variant="h5">Reset PIN</Typography>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={3}>
          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange, ...restField } }) => (
              <PhoneInput
                value={value || ''}
                onChange={onChange}
                error={errors.phone?.message}
                label="Phone number (required if no npub)"
                {...restField}
              />
            )}
          />
          <Typography variant="body2" color="text.secondary" align="center">
            Or
          </Typography>
          <Controller
            control={control}
            name="npub"
            render={({ field }) => (
              <FormControl error={Boolean(errors.npub)}>
                <InputLabel>Nostr Public Key (npub)</InputLabel>
                <OutlinedInput
                  {...field}
                  label="Nostr Public Key (npub)"
                  placeholder="Required if no phone number"
                />
                {errors.npub ? (
                  <FormHelperText>{errors.npub.message}</FormHelperText>
                ) : null}
              </FormControl>
            )}
          />
          {errors.root ? (
            <Alert color="error">{errors.root.message}</Alert>
          ) : null}
          <Button disabled={isPending} type="submit" variant="contained">
            Send recovery code
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}

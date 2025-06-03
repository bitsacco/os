'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Stack, CircularProgress } from '@mui/material';
import { VerifyOtpForm } from '@/components/auth/verify-otp-form';

function VerifyContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') || undefined;
  const npub = searchParams.get('npub') || undefined;

  return <VerifyOtpForm phone={phone} npub={npub} />;
}

// This ensures Next.js doesn't try to statically generate this dynamic page
export const dynamic = 'force-dynamic';

export default function VerifyPage(): React.JSX.Element {
  return (
    <Stack
      spacing={4}
      sx={{
        mx: 'auto',
        px: 3,
        py: 8,
        width: '100%',
        maxWidth: 400,
      }}
    >
      <React.Suspense fallback={<CircularProgress />}>
        <VerifyContent />
      </React.Suspense>
    </Stack>
  );
}

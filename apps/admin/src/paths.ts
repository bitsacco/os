export const paths = {
  home: '/',
  auth: {
    signIn: '/auth/sign-in',
    signUp: '/auth/sign-up',
    resetPassword: '/auth/reset-password',
    verify: '/auth/verify',
  },
  dashboard: {
    overview: '/dashboard',
    account: '/dashboard/account',
    membership: '/dashboard/membership',
    settings: '/dashboard/settings',
  },
  errors: { notFound: '/errors/not-found' },
} as const;

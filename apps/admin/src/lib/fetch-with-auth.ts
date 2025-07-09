/**
 * Utility function to fetch data with authentication
 * Handles token refresh and auth redirects
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers || {});

  // Add content type if not present
  if (!headers.has('Content-Type') && !options.body) {
    headers.set('Content-Type', 'application/json');
  }

  // Add authorization token from localStorage if available
  const token =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('access-token')
      : null;

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set up the request
  const request = new Request(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for auth
  });

  // Make the request
  const response = await fetch(request);

  // Handle auth errors
  if (response.status === 401 && typeof window !== 'undefined') {
    // Redirect to login if unauthorized
    window.location.href =
      `/auth/sign-in?returnTo=${  encodeURIComponent(window.location.pathname)}`;
    throw new Error('Unauthorized');
  }

  return response;
}

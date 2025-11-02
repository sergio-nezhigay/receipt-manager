'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Mark as client-side mounted
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Only run on client-side
    if (!isClient) return;

    // Don't redirect if already on login page
    if (pathname === '/login') {
      return;
    }

    // Check for auth token
    const token = localStorage.getItem('auth_token');

    if (!token) {
      console.log('No auth token found, redirecting to login');
      router.push('/login');
    }
  }, [pathname, router, isClient]);

  // Render children immediately (don't block on auth check)
  return <>{children}</>;
}

"use client";
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function OAuthCallback() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      window.location.href = '/authorize?error=' + encodeURIComponent(error);
      return;
    }

    if (code) {
      exchangeCodeForTokens(code, state);
    }
  }, [searchParams]);

  const exchangeCodeForTokens = async (code: string, state: string | null) => {
    try {
      console.log('🔍 Exchanging code for tokens...');
      
      // Call your existing token exchange API
      const response = await fetch('/api/oauth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Token exchange successful');
        
        // Store tokens and profile
        localStorage.setItem('google_tokens', JSON.stringify(data.tokens));
        localStorage.setItem('google_profile', JSON.stringify(data.profile));
        
        // Redirect back to authorize page to show Apify step
        window.location.href = '/authorize?step=apify';
      } else {
        throw new Error(data.message || 'Token exchange failed');
      }
    } catch (error: any) {
      console.error('Token exchange failed:', error);
      window.location.href = '/authorize?error=' + encodeURIComponent(error.message);
    }
  };

  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ 
        width: '24px', 
        height: '24px', 
        border: '3px solid #f3f3f3',
        borderTop: '3px solid #4285f4',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 20px'
      }}></div>
      <h2>Processing authentication...</h2>
      <p style={{ color: '#666' }}>Please wait while we complete your sign-in.</p>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

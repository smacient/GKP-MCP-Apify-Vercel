"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Declare global google object for cleanup
declare global {
  interface Window {
    google: any;
  }
}

export default function McpAuthClient() {
  const searchParams = useSearchParams();
  const [apifyToken, setApifyToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [googleProfile, setGoogleProfile] = useState<any>(null);
  const [showApifyStep, setShowApifyStep] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = (info: string) => {
    console.log(info);
    setDebugInfo(prev => [...prev, info]);
  };

  useEffect(() => {
    // Check if we're returning from OAuth or if user is already authenticated
    const step = searchParams.get('step');
    const error = searchParams.get('error');
    
    if (error) {
      setError(decodeURIComponent(error));
      return;
    }

    if (step === 'apify') {
      // User completed OAuth2, now show Apify token step
      const profile = localStorage.getItem('google_profile');
      if (profile) {
        setGoogleProfile(JSON.parse(profile));
        setShowApifyStep(true);
      }
    }
  }, [searchParams]);

  // ✅ OAuth2 Flow for GKP (minimal scopes)
  const initiateGoogleOAuth = () => {
    addDebugInfo("🔍 Starting GKP OAuth2 flow...");
    
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    addDebugInfo(`Client ID: ${clientId ? 'Found' : 'MISSING!'}`);
    
    if (!clientId) {
      setError("Google Client ID not configured. Please check environment variables.");
      return;
    }

    setIsLoading(true);
    
    // Store original OAuth parameters for later use
    const originalParams = searchParams.toString();
    localStorage.setItem('oauth_original_params', originalParams);

    const redirectUri = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/oauth/callback`;
    // ✅ UPDATED: Minimal scopes for basic authentication only
    const scope = 'openid email profile';
    
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state: originalParams // Pass original params through state
    });

    addDebugInfo(`🔄 Redirecting to: ${authUrl}`);
    window.location.href = authUrl;
  };

  // Handle final submission with Apify token
  const handleFinalSubmit = async () => {
    if (!apifyToken.trim()) {
      setError("Please enter your Apify API token");
      return;
    }
    if (!apifyToken.startsWith('apify_api_')) {
      setError("Invalid Apify token format. It should start with 'apify_api_'");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get original OAuth parameters
      const originalParams = localStorage.getItem('oauth_original_params') || '';
      // ✅ UPDATED: Point to GKP backend
      const callbackUrl = `${process.env.NEXT_PUBLIC_GKP_BACKEND_URL}/callback?${originalParams}`;
      addDebugInfo(`🔍 GKP Callback URL: ${callbackUrl}`);

      // Get the stored tokens and profile
      const tokens = localStorage.getItem('google_tokens');
      const profile = localStorage.getItem('google_profile');
      
      if (!tokens || !profile) {
        throw new Error("Authentication data lost. Please sign in again.");
      }

      const parsedTokens = JSON.parse(tokens);
      const parsedProfile = JSON.parse(profile);

      // ✅ Sending proper access tokens for GKP
      const requestBody = {
        session: {
          access_token: parsedTokens.access_token,
          user: {
            id: parsedProfile.sub,
            email: parsedProfile.email,
          }
        },
        google_credentials: {
          access_token: parsedTokens.access_token,
          refresh_token: parsedTokens.refresh_token,
          expires_in: parsedTokens.expires_in || 3600,
          scope: parsedTokens.scope, // Basic profile scope
        },
        google_profile: {
          id: parsedProfile.sub,
          email: parsedProfile.email,
          name: parsedProfile.name,
        },
        client_metadata: {},
        apify_token: apifyToken,
      };

      const fetchResponse = await fetch(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await fetchResponse.json();
      if (!fetchResponse.ok || !data.success) {
        throw new Error(data.message || "An unknown error occurred on the server.");
      }

      // Clean up stored data
      localStorage.removeItem('google_tokens');
      localStorage.removeItem('google_profile');
      localStorage.removeItem('oauth_original_params');

      addDebugInfo("✅ GKP Server responded with success");
      window.location.href = data.redirectUrl;

    } catch (err: any) {
      addDebugInfo(`❌ Error: ${err.message}`);
      setError(`Error: ${err.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="h1">🔗 Connect Your GKP Account</h1>
        <p className="p">
          {!showApifyStep 
            ? "First, sign in with Google to access Keyword Planner" 
            : "Now, provide your Apify API token for data processing"
          }
        </p>

        {!showApifyStep ? (
          // Step 1: OAuth2 Sign-In
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              margin: "2rem 0",
              minHeight: '60px',
              alignItems: 'center'
            }}>
              {isLoading ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    width: '24px', 
                    height: '24px', 
                    border: '3px solid #f3f3f3',
                    borderTop: '3px solid #4285f4',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 10px'
                  }}></div>
                  <p style={{ margin: 0, color: '#666' }}>Redirecting to Google...</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={initiateGoogleOAuth}
                    className="btn"
                    style={{
                      width: '300px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {/* Google Icon */}
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google
                  </button>
                  <div className="note">
                    <p>We'll redirect you to Google for secure authentication</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Step 2: Apify Token Input
          <div>
            <div className="note" style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '1rem', 
              borderRadius: '8px', 
              marginBottom: '1.5rem',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  backgroundColor: '#34c759',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '0.5rem'
                }}>
                  <span style={{ color: 'white', fontSize: '14px' }}>✓</span>
                </div>
                <span style={{ color: '#333', fontWeight: '500' }}>
                  Signed in as {googleProfile?.email}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="apifyToken" style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#333'
              }}>
                Apify API Token
              </label>
              <input
                type="text"
                id="apifyToken"
                placeholder="apify_api_xxxxx"
                value={apifyToken}
                onChange={(e) => setApifyToken(e.target.value)}
                disabled={isLoading}
                className="input"
              />
              <div className="note">
                <p>Your token is stored securely and only used for GKP data processing.</p>
              </div>
            </div>

            <button
              onClick={handleFinalSubmit}
              disabled={isLoading || !apifyToken.trim()}
              className="btn"
              style={{
                width: '100%',
                backgroundColor: isLoading || !apifyToken.trim() ? '#ccc' : undefined,
                cursor: isLoading || !apifyToken.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Connecting to GKP...' : 'Complete GKP Setup'}
            </button>

            <button
              onClick={() => {
                setShowApifyStep(false);
                setGoogleProfile(null);
                localStorage.removeItem('google_tokens');
                localStorage.removeItem('google_profile');
              }}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: 'transparent',
                color: '#666',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                marginTop: '0.5rem'
              }}
            >
              ← Back to Google Sign-In
            </button>
          </div>
        )}

        {error && (
          <div className="status err">
            {error}
          </div>
        )}
        
        {/* Debug info - only show in development */}
        {process.env.NODE_ENV === 'development' && (
          <details style={{ marginTop: '2rem', fontSize: '12px' }}>
            <summary style={{ cursor: 'pointer', color: '#666' }}>Debug Info</summary>
            <div style={{ 
              background: '#f5f5f5', 
              padding: '10px', 
              marginTop: '5px',
              borderRadius: '4px',
              maxHeight: '200px',
              overflow: 'auto'
            }}>
              {debugInfo.map((info, i) => (
                <div key={i} style={{ fontFamily: 'monospace' }}>{info}</div>
              ))}
            </div>
          </details>
        )}

        {/* CSS for spinner animation */}
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

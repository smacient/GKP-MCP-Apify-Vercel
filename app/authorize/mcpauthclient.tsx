"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Declare global google object for cleanup
declare global {
  interface Window {
    google: any;
  }
}

export default function GkpAuthClient() {
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

  // OAuth2 Flow for GKP (minimal scopes)
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
    // Minimal scopes for basic authentication only
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
      setError("Please enter your Apify API token to complete the GKP integration setup.");
      return;
    }
    if (!apifyToken.startsWith('apify_api_')) {
      setError("Invalid Apify token format. Your token should start with 'apify_api_' followed by your unique identifier.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get original OAuth parameters
      const originalParams = localStorage.getItem('oauth_original_params') || '';
      // Point to GKP backend
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

      // Sending proper access tokens for GKP
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

  const goBackToStep1 = () => {
    setShowApifyStep(false);
    setGoogleProfile(null);
    setApifyToken("");
    setError(null);
    localStorage.removeItem('google_tokens');
    localStorage.removeItem('google_profile');
  };

  return (
    <>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
          background: linear-gradient(to right, #0045a0 0%, #54d348 100%);
          background-attachment: fixed;
          background-repeat: no-repeat;
          overflow-x: hidden;
        }
        
        #__next {
          height: 100%;
          background: transparent;
        }
      `}</style>

      <style jsx>{`
        .container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          background: transparent;
          min-height: 100vh;
          padding: 1.5rem 1rem 1rem 1rem;
        }

        .landing-text {
          text-align: center;
          max-width: 600px;
          margin: 0 auto 1.5rem auto;
          transition: all 0.3s ease;
          opacity: ${showApifyStep ? '0' : '1'};
          transform: ${showApifyStep ? 'translateY(-10px)' : 'translateY(0)'};
          height: ${showApifyStep ? '0' : 'auto'};
          overflow: hidden;
          pointer-events: ${showApifyStep ? 'none' : 'auto'};
        }

        .landing-text h1 {
          font-size: 2.2rem;
          font-weight: 800;
          color: white;
          margin: 0 0 0.8rem 0;
          letter-spacing: -0.02em;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          line-height: 1.2;
        }

        .landing-text p {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.5;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          margin: 0 0 1rem 0;
        }

        .feature-badges {
          display: flex;
          gap: 0.8rem;
          justify-content: center;
          flex-wrap: wrap;
          margin: 0;
        }

        .badge {
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          padding: 0.4rem 0.8rem;
          border-radius: 16px;
          color: white;
          font-size: 0.85rem;
          font-weight: 500;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .main-container {
          width: 100%;
          max-width: 460px;
          margin: 0 auto;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          box-shadow: 
            0 15px 35px rgba(0, 0, 0, 0.1),
            0 1px 3px rgba(0, 0, 0, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.2);
          position: relative;
          overflow: hidden;
        }

        .main-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
        }

        .header {
          text-align: center;
          padding: 1.5rem 1.5rem 0.8rem 1.5rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .header h1 {
          font-size: 1.3rem;
          font-weight: 700;
          background: linear-gradient(135deg, #0045a0, #54d348);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0.5rem 0 0.3rem 0;
          letter-spacing: -0.02em;
        }

        .header p {
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 400;
          line-height: 1.3;
          margin: 0;
        }

        .step-container {
          padding: 1.2rem 1.5rem 1.5rem 1.5rem;
        }

        .google-btn {
          width: 100%;
          max-width: 300px;
          margin: 0 auto;
          padding: 14px 20px;
          background: linear-gradient(135deg, #4285f4, #34a853);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
          position: relative;
          overflow: hidden;
        }

        .google-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s;
        }

        .google-btn:hover::before {
          left: 100%;
        }

        .google-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(66, 133, 244, 0.4);
        }

        .google-btn:active {
          transform: translateY(0);
        }

        .helper-text {
          font-size: 12px;
          color: #64748b;
          text-align: center;
          margin-top: 8px;
          line-height: 1.3;
        }

        .loading-state {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 1rem 0;
        }

        .spinner {
          width: 28px;
          height: 28px;
          border: 2px solid rgba(66, 133, 244, 0.1);
          border-top: 2px solid #4285f4;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .success-box {
          background: linear-gradient(135deg, rgba(52, 199, 89, 0.1), rgba(66, 133, 244, 0.1));
          border: 1px solid rgba(52, 199, 89, 0.2);
          padding: 12px;
          border-radius: 10px;
          margin-bottom: 16px;
        }

        .success-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .success-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #34c759, #30d158);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .success-text {
          color: #1e293b;
          font-weight: 600;
          font-size: 13px;
        }

        .user-email {
          color: #0045a0;
          font-weight: 700;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          margin-bottom: 5px;
          font-weight: 600;
          color: #1e293b;
          font-size: 13px;
        }

        .input-field {
          width: 100%;
          padding: 12px 14px;
          font-size: 14px;
          border: 2px solid rgba(148, 163, 184, 0.2);
          border-radius: 8px;
          outline: none;
          transition: all 0.3s ease;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          box-sizing: border-box;
        }

        .input-field:focus {
          border-color: #4285f4;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
        }

        .input-field::placeholder {
          color: #94a3b8;
        }

        .input-field:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .input-helper {
          font-size: 11px;
          color: #64748b;
          margin-top: 4px;
          line-height: 1.3;
        }

        .primary-btn {
          width: 100%;
          padding: 12px 20px;
          background: linear-gradient(135deg, #0045a0, #54d348);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 3px 12px rgba(0, 69, 160, 0.3);
          position: relative;
          overflow: hidden;
        }

        .primary-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s;
        }

        .primary-btn:hover::before {
          left: 100%;
        }

        .primary-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 5px 18px rgba(0, 69, 160, 0.4);
        }

        .primary-btn:disabled {
          background: linear-gradient(135deg, #cbd5e1, #e2e8f0);
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .primary-btn:disabled::before {
          display: none;
        }

        .secondary-btn {
          width: 100%;
          padding: 8px 16px;
          background: transparent;
          color: #64748b;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          margin-top: 8px;
          transition: all 0.3s ease;
        }

        .secondary-btn:hover:not(:disabled) {
          background: rgba(100, 116, 139, 0.1);
          color: #475569;
        }

        .secondary-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .error-box {
          color: #dc2626;
          background: linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(239, 68, 68, 0.1));
          border: 1px solid rgba(220, 38, 38, 0.2);
          padding: 12px 14px;
          border-radius: 8px;
          margin-top: 12px;
          font-size: 12px;
          line-height: 1.4;
          backdrop-filter: blur(10px);
        }

        .btn-loading {
          position: relative;
          pointer-events: none;
        }

        .btn-loading::after {
          content: '';
          position: absolute;
          width: 16px;
          height: 16px;
          top: 50%;
          left: 50%;
          margin-left: -8px;
          margin-top: -8px;
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .debug-info {
          margin-top: 1rem;
          font-size: 11px;
        }

        .debug-content {
          background: rgba(0, 0, 0, 0.1);
          color: white;
          padding: 8px;
          margin-top: 4px;
          border-radius: 4px;
          max-height: 150px;
          overflow: auto;
          font-family: monospace;
          backdrop-filter: blur(10px);
        }

        @media (max-width: 480px) {
          .container {
            padding: 1rem 0.8rem 0.8rem 0.8rem;
          }
          
          .landing-text h1 {
            font-size: 1.9rem;
          }
          
          .landing-text p {
            font-size: 0.95rem;
          }
          
          .main-container {
            margin: 0;
          }
          
          .header {
            padding: 1.2rem 1.2rem 0.6rem 1.2rem;
          }
          
          .step-container {
            padding: 1rem 1.2rem 1.2rem 1.2rem;
          }
        }
      `}</style>

      <div className="container">
        {/* Landing Text Above Container (only visible on step 1) */}
        <div className="landing-text">
          <h1>GKP-Apify Integration</h1>
          <p>
            Connect your Google Keyword Planner access with Apify's powerful web scraping platform. 
            Automate keyword research, extract competitive intelligence, and streamline your SEO 
            workflow with this secure integration setup.
          </p>
          <div className="feature-badges">
            <div className="badge">🔒 Secure OAuth2</div>
            <div className="badge">🔍 Keyword Planner</div>
            <div className="badge">🔗 Apify Integration</div>
          </div>
        </div>

        <main className="main-container">
          <div className="header">
            <div style={{ marginBottom: '0.5rem' }}>
              {/* Compact Security Shield SVG */}
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:"#0045a0"}}/>
                    <stop offset="100%" style={{stopColor:"#54d348"}}/>
                  </linearGradient>
                </defs>
                <path 
                  d="M12 2L3 6V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V6L12 2Z" 
                  fill="url(#shieldGradient)" 
                  stroke="rgba(255,255,255,0.3)" 
                  strokeWidth="0.5"
                />
                <path 
                  d="M9 12L11 14L15 10" 
                  stroke="white" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1>Connect Your Accounts</h1>
            <p>
              {!showApifyStep 
                ? "First, sign in with Google to access Keyword Planner" 
                : "Now, provide your Apify API token to complete the integration"
              }
            </p>
          </div>

          <div className="step-container">
            {!showApifyStep ? (
              // Step 1: Google Sign-In (Always show button immediately)
              <div>
                <div style={{ textAlign: 'center' }}>
                  {isLoading ? (
                    <div className="loading-state">
                      <div className="spinner"></div>
                      <p style={{ color: '#64748b', fontWeight: '500', margin: 0 }}>Redirecting to Google...</p>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={initiateGoogleOAuth}
                        className="google-btn"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="white"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/>
                        </svg>
                        Sign in with Google
                      </button>
                      <p className="helper-text">
                        Secure OAuth2 authentication for Keyword Planner access
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              // Step 2: Apify Token Input
              <div>
                <div className="success-box">
                  <div className="success-indicator">
                    <div className="success-icon">
                      <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="success-text">
                        Signed in as <span className="user-email">{googleProfile?.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="apifyToken" className="form-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="10" rx="2" ry="2"/>
                        <circle cx="12" cy="16" r="1"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      Apify API Token
                    </span>
                  </label>
                  <input
                    type="text"
                    id="apifyToken"
                    placeholder="apify_api_xxxxxxxxxxxxxxxxxxxxx"
                    value={apifyToken}
                    onChange={(e) => setApifyToken(e.target.value)}
                    disabled={isLoading}
                    className="input-field"
                  />
                  <p className="input-helper">
                    Your token is encrypted and stored securely for keyword research operations only.
                  </p>
                </div>

                <button
                  onClick={handleFinalSubmit}
                  disabled={isLoading || !apifyToken.trim()}
                  className={`primary-btn ${isLoading ? 'btn-loading' : ''}`}
                >
                  {isLoading ? 'Connecting to GKP...' : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                      Complete GKP Setup
                    </span>
                  )}
                </button>

                <button
                  onClick={goBackToStep1}
                  disabled={isLoading}
                  className="secondary-btn"
                >
                  ← Back to Google Sign-In
                </button>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-box">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                {error}
              </span>
            </div>
          )}
        </main>

        {/* Debug info - only show in development */}
        {process.env.NODE_ENV === 'development' && (
          <details className="debug-info">
            <summary style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>Debug Info</summary>
            <div className="debug-content">
              {debugInfo.map((info, i) => (
                <div key={i}>{info}</div>
              ))}
            </div>
          </details>
        )}
      </div>
    </>
  );
}

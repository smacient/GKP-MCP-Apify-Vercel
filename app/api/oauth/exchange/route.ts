import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json();
    
    console.log('🔍 Exchanging authorization code for tokens...');
    
    if (!code) {
      return NextResponse.json({ 
        success: false, 
        message: 'Authorization code is required' 
      });
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/oauth/callback`
      })
    });

    const tokens = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      throw new Error(tokens.error_description || 'Failed to exchange code for tokens');
    }

    console.log('✅ Tokens received');

    // Get user profile using the access token
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    const profile = await profileResponse.json();
    
    if (!profileResponse.ok) {
      throw new Error('Failed to fetch user profile');
    }

    console.log('✅ User profile retrieved');

    // Return tokens and profile to frontend - backend handles database storage
    return NextResponse.json({
      success: true,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        token_type: tokens.token_type
      },
      profile: {
        sub: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture
      }
    });

  } catch (error: any) {
    console.error('Token exchange error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}
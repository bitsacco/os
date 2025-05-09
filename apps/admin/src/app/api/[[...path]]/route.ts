import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function GET(
  request: NextRequest,
  { params }: { params: { path?: string[] } },
) {
  return handleRequest(request, params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path?: string[] } },
) {
  return handleRequest(request, params, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path?: string[] } },
) {
  return handleRequest(request, params, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path?: string[] } },
) {
  return handleRequest(request, params, 'DELETE');
}

async function handleRequest(
  request: NextRequest,
  { path }: { path?: string[] },
  method: string,
) {
  try {
    // Construct the target URL
    const targetPath = path?.join('/') || '';
    // Ensure we have a properly formatted URL by handling both API_URL with and without trailing slash
    const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    const url = `${baseUrl}${targetPath ? `/${targetPath}` : ''}`;

    // Extract headers from the incoming request
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      // Forward all headers except host and connection
      if (key !== 'host' && key !== 'connection') {
        headers.set(key, value);
      }
    });

    // Clone the request body
    let body = null;
    if (method !== 'GET' && method !== 'HEAD') {
      body = await request.blob();
    }

    // Make the request to the API
    const apiResponse = await fetch(url, {
      method,
      headers,
      body,
      credentials: 'include',
    });

    // Get response body as blob
    const responseData = await apiResponse.blob();

    // Create a response with the same status, headers, and body
    const response = new NextResponse(responseData, {
      status: apiResponse.status,
      statusText: apiResponse.statusText,
    });

    // Copy headers from API response
    apiResponse.headers.forEach((value, key) => {
      if (key !== 'content-length') {
        // Skip content-length which will be set automatically
        response.headers.set(key, value);
      }
    });

    // Ensure CORS headers are set
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS',
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization',
    );

    return response;
  } catch (error) {
    console.error('API error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to process API request' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

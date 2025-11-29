import { NextRequest, NextResponse } from 'next/server';
import { UploadRequest, UploadResponse } from '@/types';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    const body: UploadRequest = await request.json();
    const { scope, data } = body;

    const response = await fetch(`${BACKEND_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scope, data }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }

    const result: UploadResponse = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

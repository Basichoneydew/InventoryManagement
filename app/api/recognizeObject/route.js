import { NextResponse } from 'next/server';
import vision from '@google-cloud/vision';

const client = new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

export async function POST(req) {
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== process.env.API_SECRET_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { image } = body;
        const base64Image = image.split(',')[1];
        const [result] = await client.labelDetection({
            image: {
                content: base64Image
            }
        });
        const labels = result.labelAnnotations;
        const recognizedItem = labels.length > 0 ? labels[0].description : null;

        return NextResponse.json({ item: recognizedItem });
    } catch (error) {
        console.error('Error processing image:', error);
        return NextResponse.json({ error: 'Error processing image' }, { status: 500 });
    }
}
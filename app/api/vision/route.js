import vision from '@google-cloud/vision';
import path from 'path';

export async function POST(req) {
    console.log('Vision API route called');
    const { image } = await req.json();

    if (!image) {
        console.log('No image data received');
        return new Response(JSON.stringify({ error: 'Missing image data' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    console.log('Image data received, length:', image.length);

    const credentialsPath = path.join(process.cwd(), 'secrets', 'google-credentials.json');
    console.log('Credentials path:', credentialsPath);

    const client = new vision.ImageAnnotatorClient({
        keyFilename: credentialsPath
    });

    try {
        const buffer = Buffer.from(image.split(',')[1], 'base64');
        console.log('Image decoded, buffer length:', buffer.length);

        const [result] = await client.labelDetection(buffer);
        console.log('Vision API response:', JSON.stringify(result, null, 2));

        const labels = result.labelAnnotations;
        const item = labels[0]?.description || 'Unknown item';
        console.log('Detected item:', item);

        return new Response(JSON.stringify({ item }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error calling Vision API:', error);
        return new Response(JSON.stringify({ error: 'Failed to process image' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
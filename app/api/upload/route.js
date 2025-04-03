import { ImageAnnotatorClient } from '@google-cloud/vision';
import { NextResponse } from 'next/server';

const vision = new ImageAnnotatorClient();

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded' },
                { status: 400 }
            );
        }

        // Check file type
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Please upload a PDF or image file.' },
                { status: 400 }
            );
        }

        // Convert file to buffer
        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        // Process with Vision API
        const [result] = await vision.documentTextDetection({
            image: {
                content: uint8Array
            }
        });

        const fullTextAnnotation = result.fullTextAnnotation;

        if (!fullTextAnnotation) {
            return NextResponse.json(
                { error: 'No text found in the document' },
                { status: 400 }
            );
        }

        // Structure the response
        const response = {
            text: fullTextAnnotation.text,
            confidence: fullTextAnnotation.confidence,
            pages: fullTextAnnotation.pages.map(page => ({
                width: page.width,
                height: page.height,
                blocks: page.blocks.map(block => ({
                    text: block.paragraphs
                        .map(p => p.words.map(w => w.symbols.map(s => s.text).join('')).join(' '))
                        .join('\n'),
                    confidence: block.confidence,
                    boundingBox: block.boundingBox
                }))
            }))
        };

        return NextResponse.json({
            success: true,
            data: response
        });

    } catch (error) {
        console.error('Error processing file:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to process file',
                details: error.message
            },
            { status: 500 }
        );
    }
}

import { NextResponse } from 'next/server';
import { AIOrchestrationService } from '../../services/ai/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for processing

// Initialize AI orchestrator
const aiOrchestrator = new AIOrchestrationService();

// Type for uploaded file
interface UploadedFile extends File {
    size: number;
    type: string;
    arrayBuffer(): Promise<ArrayBuffer>;
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as UploadedFile | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded' },
                { status: 400 }
            );
        }

        if (!file.size) {
            return NextResponse.json(
                { error: 'Empty file uploaded' },
                { status: 400 }
            );
        }

        // Log file information for debugging
        console.log('File type:', file.type);
        console.log('File size:', file.size);

        // Check file type
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Please upload a PDF or image file.' },
                { status: 400 }
            );
        }

        try {
            // Convert file to buffer
            const buffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(buffer);

            // Process document through AI orchestrator
            const result = await aiOrchestrator.processDocument(Buffer.from(uint8Array), file.type);

            if (!result.success) {
                throw new Error(result.error || 'Failed to process document');
            }

            // Return analysis result
            return NextResponse.json({
                success: true,
                analysis: result.data
            });

        } catch (processingError) {
            console.error('Document Processing Error:', {
                name: processingError.name,
                message: processingError.message,
                code: processingError.code,
                details: processingError.details,
                stack: processingError.stack
            });
            return NextResponse.json(
                {
                    success: false,
                    error: 'Document processing failed',
                    details: processingError.message
                },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Error processing file:', {
            name: error.name,
            message: error.message,
            code: error.code,
            details: error.details,
            stack: error.stack
        });
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

import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for processing

// Helper function to initialize OpenAI client
const getOpenAIClient = () => {
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
};

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

            // Initialize Document AI client
            const documentAiClient = new DocumentProcessorServiceClient({
                apiEndpoint: `${process.env.DOCUMENT_AI_LOCATION}-documentai.googleapis.com`
            });

            // Get processor path from environment variable
            const processorPath = process.env.DOCUMENT_AI_PROCESSOR_ID;

            console.log('Document AI client initialized. Processor path:', processorPath);

            // Base64 encode the file buffer
            const encodedBase64String = Buffer.from(uint8Array).toString('base64');

            // Construct Document AI request
            const docAiRequest = {
                name: processorPath,
                rawDocument: {
                    content: encodedBase64String,
                    mimeType: file.type
                }
            };

            console.log('Document AI request prepared');

            // Add detailed debugging logs
            console.log('--- Debugging Document AI Call ---');
            console.log('Using Endpoint Target:', `${process.env.DOCUMENT_AI_LOCATION}-documentai.googleapis.com`);
            console.log('Using Processor Path:', processorPath);
            console.log('Request Object Name:', docAiRequest.name);
            console.log('Request Mime Type:', docAiRequest.rawDocument.mimeType);
            console.log('Request Base64 Snippet:', docAiRequest.rawDocument.content.substring(0, 60) + '...');
            console.log('------------------------------------');

            // Process document with Document AI
            const [result] = await documentAiClient.processDocument(docAiRequest);

            // Log the full raw result
            console.log('Raw Document AI Result:', JSON.stringify(result, null, 2));

            // Extract and validate document
            const { document } = result;

            // Check for missing document
            if (!document) {
                console.error('Document object missing in Document AI response');
                throw new Error('Document object missing in Document AI response');
            }

            // Check for Document AI processing errors
            if (document.error) {
                console.error('Document AI reported an internal processing error:', JSON.stringify(document.error, null, 2));
                throw new Error(`Document AI processing error: ${document.error.message || 'Unknown error'}`);
            }

            // Log document structure and text length
            console.log('Document Object Keys:', Object.keys(document));
            console.log('Extracted Text Length:', document.text?.length ?? 'N/A (text missing)');

            // Initialize OpenAI client
            const openai = getOpenAIClient();

            // Define analysis prompt
            const analysisPromptText = `provide a brief summary and list up to 5 deficiencies identified in the results`;
            const fullPrompt = `${analysisPromptText} for the following lab report text:\n\n${document.text}`;

            // Construct OpenAI request
            const openAIRequestPayload = {
                model: "gpt-4o",
                messages: [{ role: "user", content: fullPrompt }]
            };

            // Log OpenAI request
            console.log('Sending request to OpenAI for analysis...');

            // Make OpenAI API call
            const openAIResponse = await openai.chat.completions.create(openAIRequestPayload);
            const analysisResult = openAIResponse.choices[0]?.message?.content?.trim() ?? 'No analysis result received.';

            console.log('Received analysis from OpenAI.');

            // Return final analysis
            return NextResponse.json({
                success: true,
                analysis: analysisResult
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

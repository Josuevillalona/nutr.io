import { ImageAnnotatorClient } from '@google-cloud/vision';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // Increased to 5 minutes for PDF processing

// Helper function to initialize Vision client
const getVisionClient = () => {
    const credentials = {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL
    };

    return new ImageAnnotatorClient({
        credentials,
        projectId: process.env.GOOGLE_PROJECT_ID
    });
};

// Helper function to initialize Storage client
const getStorageClient = () => {
    const credentials = {
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL
    };

    return new Storage({
        credentials,
        projectId: process.env.GOOGLE_PROJECT_ID
    });
};

// Helper function to validate result structure
const validateResult = (result) => {
    if (!result.responses?.length) {
        throw new Error('Invalid result format: missing responses array');
    }
    if (!result.responses[0]?.fullTextAnnotation) {
        throw new Error('Invalid result format: missing text annotation');
    }
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

        // Convert file to buffer
        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        try {
            // Initialize Vision client
            const vision = getVisionClient();

            if (file.type === 'application/pdf') {
                console.log('Processing PDF file using GCS and asyncBatchAnnotateFiles...');

                // Initialize Storage client and get bucket
                const storage = getStorageClient();
                const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

                // Generate unique filename and paths
                const uniqueFilename = `${uuidv4()}.pdf`;
                const gcsFilePath = uniqueFilename;
                const gcsOutputPrefix = 'ocr-results/';

                console.log('Uploading PDF to GCS...');

                // Upload PDF to GCS
                try {
                    await bucket.file(gcsFilePath).save(uint8Array, {
                        contentType: 'application/pdf'
                    });
                    console.log('PDF uploaded successfully to GCS');
                } catch (uploadError) {
                    console.error('GCS Upload Error:', {
                        message: uploadError.message,
                        details: uploadError.details
                    });
                    throw new Error(`Failed to upload PDF to GCS: ${uploadError.message}`);
                }

                // Configure Vision API request for PDF processing
                const request = {
                    requests: [{
                        inputConfig: {
                            gcsSource: {
                                uri: `gs://${process.env.GCS_BUCKET_NAME}/${gcsFilePath}`
                            },
                            mimeType: 'application/pdf'
                        },
                        features: [{
                            type: 'DOCUMENT_TEXT_DETECTION'
                        }],
                        outputConfig: {
                            gcsDestination: {
                                uri: `gs://${process.env.GCS_BUCKET_NAME}/${gcsOutputPrefix}`
                            }
                        }
                    }]
                };

                // Call Vision API with GCS paths and wait for completion
                const [operation] = await vision.asyncBatchAnnotateFiles(request);
                console.log('Vision API operation initiated:', operation.name);

                console.log('Waiting for operation to complete...');
                const [filesResponse] = await operation.promise();
                console.log('Operation complete');

                if (!filesResponse || !filesResponse.responses) {
                    throw new Error('Invalid operation result format');
                }

                // Extract output URI from operation result
                const outputUri = filesResponse.responses[0]?.outputConfig?.gcsDestination?.uri;
                if (!outputUri) {
                    throw new Error('No output URI found in operation result');
                }

                // Parse GCS URI to get bucket and prefix
                const gcsUriMatch = outputUri.match(/gs:\/\/([^/]+)\/(.+)/);
                if (!gcsUriMatch) {
                    throw new Error('Invalid GCS URI format');
                }

                const [, bucketName, prefix] = gcsUriMatch;
                console.log('Retrieving results from GCS...');

                // Get JSON files from the output location
                const [files] = await bucket.getFiles({ prefix });
                const jsonFiles = files.filter(file => file.name.endsWith('.json'));

                if (jsonFiles.length === 0) {
                    throw new Error('No result files found in GCS');
                }

                // Download and process results
                const results = await Promise.all(
                    jsonFiles.map(async file => {
                        const [content] = await file.download();
                        return JSON.parse(content.toString());
                    })
                );

                // Process results from all pages
                const processedResults = results.map(result => {
                    validateResult(result);

                    // Safely extract text and metadata
                    const firstResponse = result.responses[0];
                    const text = firstResponse.fullTextAnnotation?.text ?? '';
                    const confidence = firstResponse.fullTextAnnotation?.confidence ?? null;
                    const pageNumber = firstResponse.context?.pageNumber ?? 1;

                    return {
                        text,
                        confidence,
                        pageNumber
                    };
                });

                // Sort by page number
                processedResults.sort((a, b) => a.pageNumber - b.pageNumber);

                return NextResponse.json({
                    success: true,
                    pages: processedResults,
                    totalPages: processedResults.length,
                    combinedText: processedResults.map(r => r.text).join('\n')
                });

            } else {
                console.log('Processing image file using annotateImage...');

                // Convert image to base64
                const base64Content = Buffer.from(uint8Array).toString('base64');

                // Configure image-specific request
                const request = {
                    image: {
                        content: base64Content
                    },
                    features: [{
                        type: 'DOCUMENT_TEXT_DETECTION'
                    }]
                };

                // Process image using annotateImage
                const [result] = await vision.annotateImage(request);

                if (!result) {
                    throw new Error('No result from Vision API');
                }

                if (!result.fullTextAnnotation) {
                    throw new Error('No text found in the document');
                }

                const { fullTextAnnotation } = result;

                // Structure response
                const response = {
                    text: fullTextAnnotation.text,
                    confidence: fullTextAnnotation.confidence ?? null,
                    pages: [{
                        text: fullTextAnnotation.text,
                        confidence: fullTextAnnotation.confidence ?? null,
                        pageNumber: 1
                    }],
                    totalPages: 1
                };

                return NextResponse.json({
                    success: true,
                    data: response
                });
            }

        } catch (processingError) {
            console.error('Document Processing Error:', {
                name: processingError.name,
                message: processingError.message,
                code: processingError.code,
                details: processingError.details
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
            details: error.details
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

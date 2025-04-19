import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { AIServiceResult } from './types';

export class DocumentAIService {
    private client: DocumentProcessorServiceClient;
    private processorPath: string;

    constructor() {
        this.client = new DocumentProcessorServiceClient({
            apiEndpoint: `${process.env.DOCUMENT_AI_LOCATION}-documentai.googleapis.com`
        });
        this.processorPath = process.env.DOCUMENT_AI_PROCESSOR_ID || '';
    }

    async extractText(buffer: Buffer, mimeType: string): Promise<AIServiceResult> {
        try {
            // Base64 encode the buffer
            const encodedContent = buffer.toString('base64');

            // Construct Document AI request
            const request = {
                name: this.processorPath,
                rawDocument: {
                    content: encodedContent,
                    mimeType: mimeType
                }
            };

            // Process document
            const [result] = await this.client.processDocument(request);

            // Validate response
            if (!result.document) {
                throw new Error('Document AI processing returned no document');
            }

            if (result.document.error) {
                throw new Error(`Document AI processing error: ${result.document.error.message || 'Unknown error'}`);
            }

            return {
                success: true,
                data: result.document.text || ''
            };

        } catch (error) {
            console.error('Document AI Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to process document'
            };
        }
    }
}

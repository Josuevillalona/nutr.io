import { AIServiceResult, AIOrchestrator } from './types';
import { DocumentAIService } from './document-ai.service';
import { OpenAIService } from './openai.service';

export class AIOrchestrationService implements AIOrchestrator {
    private documentAI: DocumentAIService;
    private openAI: OpenAIService;

    constructor() {
        this.documentAI = new DocumentAIService();
        this.openAI = new OpenAIService();
    }

    async processDocument(buffer: Buffer, mimeType: string): Promise<AIServiceResult> {
        try {
            // Step 1: Extract text using Document AI
            const textResult = await this.documentAI.extractText(buffer, mimeType);
            if (!textResult.success) {
                return textResult;
            }

            // Step 2: Analyze text using OpenAI
            const analysisResult = await this.analyzeText(textResult.data);
            return analysisResult;

        } catch (error) {
            console.error('AI Orchestration Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to process document'
            };
        }
    }

    async analyzeText(text: string): Promise<AIServiceResult> {
        try {
            // Analyze the text using OpenAI
            const analysisResult = await this.openAI.analyzeLabReport(text);
            return analysisResult;

        } catch (error) {
            console.error('Text Analysis Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to analyze text'
            };
        }
    }

    // Method for future implementation of fallback processing
    async processWithFallback(buffer: Buffer, mimeType: string): Promise<AIServiceResult> {
        try {
            // First try primary processing
            const result = await this.processDocument(buffer, mimeType);
            if (result.success) {
                return result;
            }

            // TODO: Implement fallback processing logic here
            // For example, try alternative OCR service or different model

            return result;

        } catch (error) {
            console.error('Fallback Processing Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to process with fallback'
            };
        }
    }
}

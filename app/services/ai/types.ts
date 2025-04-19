export interface AIServiceResult {
    success: boolean;
    data?: any;
    error?: string;
}

export interface AIOrchestrator {
    processDocument(buffer: Buffer, mimeType: string): Promise<AIServiceResult>;
    analyzeText(text: string): Promise<AIServiceResult>;
}

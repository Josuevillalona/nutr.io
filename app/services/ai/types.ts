// Define the structure for individual deficiency details (as returned by AI)
export interface DeficiencyDetail {
    nutrient: string;
    notes?: string; // Include the notes field if the AI provides it
}

// Define the expected structure of the JSON output from OpenAI
export interface LabAnalysisResult {
    summary: string;
    deficiencies: DeficiencyDetail[]; // *** Ensure this is DeficiencyDetail[] ***
}

// Define the structure for the returned food recommendations
export interface FoodRecommendation {
    name: string;
    code: string;
    imageURL?: string;
    nutrientValue?: number;
    unit?: string;
    // nutriscore_grade is NOT included in this version
}

// Generic result wrapper
export interface AIServiceResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

// Interface for the AI Orchestrator service
export interface AIOrchestrator {
    processDocument(buffer: Buffer, mimeType: string): Promise<AIServiceResult<LabAnalysisResult>>;
    analyzeText(text: string): Promise<AIServiceResult<LabAnalysisResult>>;
}

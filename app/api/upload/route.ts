import { NextResponse } from 'next/server';
import { AIOrchestrationService } from '../../services/ai/orchestrator';
import { LocalFoodDataService } from '../../services/food-api/local-food-data.service';
// Import the specific types we expect and use
import { AIServiceResult, LabAnalysisResult, FoodRecommendation, DeficiencyDetail } from '../../services/ai/types'; // Ensure types.ts is updated

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

// Initialize services
const aiOrchestrator = new AIOrchestrationService();
const foodService = new LocalFoodDataService();

interface UploadedFile extends File {
    size: number;
    type: string;
    arrayBuffer(): Promise<ArrayBuffer>;
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as UploadedFile | null;

        // --- File Validation ---
        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Please upload a PDF or image file.' },
                { status: 400 }
            );
        }
        // --- End File Validation ---

        console.log('File received:', file.name, 'Type:', file.type, 'Size:', file.size);

        // Process document through AI orchestrator
        console.log('Starting AI document processing...');
        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        // Expecting AIServiceResult<LabAnalysisResult>
        const analysisResult: AIServiceResult<LabAnalysisResult> = await aiOrchestrator.processDocument(Buffer.from(uint8Array), file.type);

        if (!analysisResult.success || !analysisResult.data) {
            console.error('AI Analysis failed or returned no data:', analysisResult.error);
            return NextResponse.json(
                { success: false, error: 'Failed to analyze document', details: analysisResult.error },
                { status: 500 }
            );
        }

        // analysisResult.data is typed as LabAnalysisResult due to the type annotation above
        const analysisData = analysisResult.data;
        console.log('AI Analysis successful:', analysisData);

        // --- Fetch Food Recommendations ---
        let recommendationsMap: { [key: string]: FoodRecommendation[] } = {};
        let recommendationErrors: string[] = [];

        // *** FIX: Rely on analysisData type and use explicit types in map ***
        if (Array.isArray(analysisData.deficiencies) && analysisData.deficiencies.length > 0) {

            // Assuming analysisData.deficiencies IS DeficiencyDetail[] based on the type of analysisResult
            // Add explicit types to map callbacks for clarity
            const deficiencyNames = analysisData.deficiencies.map((d: DeficiencyDetail) => d.nutrient);
            console.log(`Fetching recommendations for deficiencies: ${deficiencyNames.join(', ')}`);

            const recommendationPromises = analysisData.deficiencies.map((deficiencyObj: DeficiencyDetail) =>
                foodService.getRecommendations(deficiencyObj.nutrient) // Pass the nutrient name (string)
                    .then(result => ({ deficiencyName: deficiencyObj.nutrient, result })) // Keep track of which name this result is for
            );

            const settledResults = await Promise.allSettled(recommendationPromises);

            settledResults.forEach(settledResult => {
                if (settledResult.status === 'fulfilled') {
                    const { deficiencyName, result } = settledResult.value;
                    if (result.success && result.data) {
                        recommendationsMap[deficiencyName] = result.data;
                    } else {
                        console.warn(`Failed to get recommendations for ${deficiencyName}: ${result.error}`);
                        recommendationErrors.push(`Could not fetch recommendations for ${deficiencyName}.`);
                        recommendationsMap[deficiencyName] = [];
                    }
                } else {
                    console.error(`Unexpected error fetching recommendations:`, settledResult.reason);
                    recommendationErrors.push(`An unexpected error occurred while fetching some recommendations.`);
                }
            });
            console.log('Finished fetching recommendations.');
        } else {
            console.log('No deficiencies identified or deficiencies format incorrect, skipping food recommendations.');
            // Ensure analysisData.deficiencies is an empty array if it wasn't valid or empty
            if (!Array.isArray(analysisData.deficiencies)) {
                analysisData.deficiencies = [];
            }
        }
        // --- End Fetch Food Recommendations ---


        // Structure the final response
        const finalResponse = {
            success: true,
            analysis: analysisData, // analysisData.deficiencies should be DeficiencyDetail[] or empty []
            recommendations: recommendationsMap,
            errors: recommendationErrors.length > 0 ? recommendationErrors : undefined
        };

        return NextResponse.json(finalResponse);

    } catch (error: any) {
        console.error('Error in POST /api/upload:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to process request',
                details: error.message
            },
            { status: 500 }
        );
    }
}

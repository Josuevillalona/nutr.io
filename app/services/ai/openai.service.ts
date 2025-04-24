import OpenAI from 'openai';
import { AIServiceResult, LabAnalysisResult } from './types';

export class OpenAIService {
    private client: OpenAI;
    private analysisPrompt: string;

    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.analysisPrompt = `Based on the following lab report text, provide a brief summary and list up to 5 deficiencies identified in the results. For each deficiency, provide the nutrient name and brief notes about the deficiency. Return the results in a JSON format with the following structure:

{
  "summary": "...",
  "deficiencies": [
    {
      "nutrient": "...",
      "notes": "..."
    },
    {
      "nutrient": "...",
      "notes": "..."
    }
  ]
}

**Important:** Do not use any Markdown formatting, code blocks, or any other non-JSON syntax in your response. Ensure the JSON is valid and parsable.`;
    }

    async analyzeLabReport(text: string): Promise<AIServiceResult> {
        try {
            // Construct full prompt
            const fullPrompt = `${this.analysisPrompt} for the following lab report text:\n\n${text}`;

            // Make OpenAI request
            const response = await this.client.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: fullPrompt }]
            });

            // Extract and validate response
            const analysisResult = response.choices[0]?.message?.content?.trim();
            if (!analysisResult) {
                throw new Error('No analysis result received from OpenAI');
            }

            try {
                // Attempt to parse the JSON result
                const parsedResult: LabAnalysisResult = JSON.parse(analysisResult);
                return {
                    success: true,
                    data: parsedResult
                };
            } catch (jsonError) {
                console.error('JSON Parsing Error:', jsonError);
                // Attempt to extract JSON from the string
                const jsonMatch = analysisResult.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const extractedJson = jsonMatch[0];
                        const parsedResult: LabAnalysisResult = JSON.parse(extractedJson);
                        return {
                            success: true,
                            data: parsedResult
                        };
                    } catch (extractionError) {
                        console.error('JSON Extraction Error:', extractionError);
                        return {
                            success: false,
                            error: 'Failed to parse JSON result from OpenAI, even after extraction'
                        };
                    }
                } else {
                    return {
                        success: false,
                        error: 'Failed to parse JSON result from OpenAI and no JSON found in response'
                    };
                }
            }

        } catch (error) {
            console.error('OpenAI Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to analyze lab report'
            };
        }
    }
}

import OpenAI from 'openai';
import { AIServiceResult } from './types';

export class OpenAIService {
    private client: OpenAI;
    private analysisPrompt: string;

    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.analysisPrompt = `Based on the following lab report text, provide a brief summary and list up to 5 deficiencies identified in the results, and for each deficiency listed, suggest 3-5 common food types that are generally high in the corresponding nutrient.`;
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

            return {
                success: true,
                data: analysisResult
            };

        } catch (error) {
            console.error('OpenAI Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to analyze lab report'
            };
        }
    }
}

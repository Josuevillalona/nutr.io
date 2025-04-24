import axios from 'axios'; // Or use Node's fetch if preferred
import { DeficiencyDetail } from '../ai/types'; // Adjust path if needed based on your exact folder structure

// Define an interface for the structure of the recommendation result (optional but good practice)
interface FoodRecommendationResult {
    nutrient: string;
    foods: string[];
}

export class OpenFoodFactsService {
    private baseUrl = 'https://world.openfoodfacts.org/api/v2/search';
    // Define a custom User-Agent (ensure this is updated with your info)
    private userAgent = 'MyHealthCompassApp/1.0 (josuevillalona@gmail.com; https://your-app-url.com)';

    constructor() { }

    /**
     * Fetches food recommendations for a list of nutrient deficiencies.
     * @param deficiencies - Array of deficiency details from AI analysis.
     * @returns A Promise resolving to an array of FoodRecommendationResult or similar structure.
     */
    async getFoodRecommendations(
        deficiencies: DeficiencyDetail[]
    ): Promise<FoodRecommendationResult[]> {
        const recommendations: FoodRecommendationResult[] = [];
        console.log(`Starting food recommendation fetch for ${deficiencies.length} deficiencies.`);

        for (const deficiency of deficiencies) {
            try {
                const nutrientQuery = deficiency.nutrient; // Use the nutrient name

                // --- MODIFIED: Construct search parameters using search_terms ---
                const params = {
                    search_terms: nutrientQuery, // <-- Use nutrient name as search term
                    // categories_tags_en: categoryQuery, // <-- Category search REMOVED for this test
                    fields: 'product_name,brands', // Request only needed fields
                    page_size: 5, // Limit results per query
                    json: 1, // Request JSON response
                };
                // Log the new query type
                console.log(`Querying Open Food Facts with search_terms: "${nutrientQuery}"`);
                // --- END MODIFICATION ---

                // Make the API call
                const response = await axios.get(this.baseUrl, {
                    params, // Use the modified params
                    headers: {
                        'User-Agent': this.userAgent,
                    },
                    timeout: 30000, // Keep longer timeout for now
                });

                // Process the response
                if (response.data && response.data.products && response.data.products.length > 0) {
                    const foods = response.data.products
                        .map((p: any) => p.product_name?.trim())
                        .filter((name: string | undefined): name is string => !!name && name.length > 0);

                    console.log(`Found ${foods.length} foods for ${nutrientQuery}:`, foods.slice(0, 5));
                    recommendations.push({ nutrient: deficiency.nutrient, foods: foods.slice(0, 5) });
                } else {
                    console.log(`No valid food products found for query: "${nutrientQuery}"`);
                    recommendations.push({ nutrient: deficiency.nutrient, foods: [] });
                }

                // Optional delay can still be added here if needed later
                // await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                let errorMsg = error.message;
                if (axios.isAxiosError(error)) {
                    errorMsg = `Axios error: ${error.code || 'Unknown code'}, Status: ${error.response?.status || 'N/A'}, Data: ${JSON.stringify(error.response?.data)?.substring(0, 100)}...`;
                }
                console.error(`Error fetching food recommendations for ${deficiency.nutrient} using search_terms:`, errorMsg);
                recommendations.push({ nutrient: deficiency.nutrient, foods: [] });
            }
        }
        console.log(`Finished food recommendation fetch. Returning ${recommendations.length} results.`);
        return recommendations;
    }

    // NOTE: The mapNutrientToCategory function is no longer used with the above change,
    // but we can keep it for potential future use or different query strategies.
    /**
     * Helper function to map nutrient names to relevant search categories.
     * NOT CURRENTLY USED with search_terms approach.
     * @param nutrient - The name of the nutrient.
     * @returns A category string or null.
     */
    private mapNutrientToCategory(nutrient: string): string | null {
        const lowerNutrient = nutrient.toLowerCase().trim();
        // --- Example Mappings ---
        if (lowerNutrient.includes('vitamin d')) return 'Milks';
        if (lowerNutrient.includes('iron')) return 'Breakfast cereals';
        if (lowerNutrient.includes('vitamin b12')) return 'Meats';
        if (lowerNutrient.includes('calcium')) return 'Yogurts';
        if (lowerNutrient.includes('vitamin c')) return 'Fruit juices';
        if (lowerNutrient.includes('magnesium')) return 'Nuts';
        if (lowerNutrient.includes('zinc')) return 'Meats';
        if (lowerNutrient.includes('folate') || lowerNutrient.includes('vitamin b9')) return 'Legumes';
        if (lowerNutrient.includes('vitamin a')) return 'Carrots';
        if (lowerNutrient.includes('vitamin e')) return 'Vegetable oils';
        if (lowerNutrient.includes('vitamin k')) return 'Green leafy vegetables';
        // --- Add more mappings ---
        console.warn(`(mapNutrientToCategory) No specific category mapping found for nutrient: "${nutrient}". Returning null.`);
        return null;
    }
}
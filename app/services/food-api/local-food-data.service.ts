import { MongoClient, Db, Collection, Sort } from 'mongodb';
import axios from 'axios';
// Import the generic type and the specific data type
import { AIServiceResult, FoodRecommendation } from '../ai/types'; // Ensure types.ts is updated (without nutriscore_grade in FoodRecommendation)

// Define the structure of a product document *in MongoDB*
interface ProductDocument {
    _id?: any;
    code: string;
    name: string;
    categories_tags?: string[];
    nutriscore_grade?: string; // Keep grade for filtering in DB
    [key: string]: any;
}

// Interface for the relevant parts of the Open Food Facts API response
interface OffApiResponse {
    status: number;
    product?: {
        code: string;
        product_name?: string;
        product_name_en?: string;
        image_front_url?: string;
        image_url?: string;
        // nutriscore_grade?: string; // Grade is NOT requested/used from API in this version
        nutriments?: {
            [key: string]: number | string | undefined;
        };
    };
}

// --- Singleton MongoClient ---
let mongoClientInstance: MongoClient | null = null;
let connectionPromise: Promise<MongoClient> | null = null;

async function getMongoClient(connectionString: string): Promise<MongoClient> {
    if (mongoClientInstance) {
        return mongoClientInstance; // Reuse existing instance
    }
    if (connectionPromise) {
        console.log("Waiting for existing connection promise.");
        return connectionPromise;
    }
    console.log("Creating new MongoDB client connection promise.");
    connectionPromise = new Promise(async (resolve, reject) => {
        try {
            const client = new MongoClient(connectionString);
            await client.connect();
            console.log("New MongoDB client connected successfully.");
            mongoClientInstance = client; // Store the connected instance
            connectionPromise = null; // Clear the promise variable
            resolve(client);
        } catch (error) {
            console.error("Failed to create new MongoDB client connection:", error);
            mongoClientInstance = null; // Ensure instance is null on error
            connectionPromise = null; // Clear the promise variable on error
            reject(error); // Reject the promise
        }
    });
    return connectionPromise;
}
// --- End Singleton MongoClient ---


export class LocalFoodDataService {
    private connectionString: string;
    private dbName: string;
    private collectionName: string;

    // Mapping from common deficiency names to the nutrient field name SUFFIX used in OFF API
    private nutrientNameMap: { [key: string]: string } = {
        "vitamin d": "vitamin-d",
        "vitamin d3": "vitamin-d",
        "iron": "iron",
        "calcium": "calcium",
        "vitamin c": "vitamin-c",
        "vitamin b12": "vitamin-b12",
        "vitamin a": "vitamin-a",
        "magnesium": "magnesium",
        "zinc": "zinc",
        "fiber": "fiber",
        "potassium": "potassium",
        "proteins": "proteins",
        "pantothenate": "pantothenic-acid", // Vitamin B5
        "vitamin b1": "vitamin-b1",
        "vitamin b2": "vitamin-b2",
        "vitamin b6": "vitamin-b6",
        "vitamin b9": "vitamin-b9",
        "folate": "folates",
        "vitamin e": "vitamin-e",
        "vitamin k": "vitamin-k",
        "vitamin k2": "vitamin-k",
        "niacin": "vitamin-pp", // Vitamin B3
        "copper": "copper",
        "manganese": "manganese",
        "selenium": "selenium",
        "iodine": "iodine",
        "oleic acid": "monounsaturated-fat",
        // Boron, Lysine remain unmapped
    };

    constructor() {
        this.connectionString = process.env.MONGODB_CONNECTION_STRING || 'mongodb+srv://josuevillalona:xrQQDocK3Bd4L5vV@cluster0.tooobky.mongodb.net/?retryWrites=true&w=majority&appName=NutrIo';
        this.dbName = process.env.MONGODB_DB_NAME || 'openfoodfacts';
        this.collectionName = process.env.MONGODB_COLLECTION_NAME || 'products';
        if (!this.connectionString || this.connectionString.includes('<password>')) {
            console.error("FATAL ERROR: MongoDB connection string is not configured properly.");
        }
    }

    /**
     * Gets the MongoDB collection, ensuring connection via the singleton.
     */
    private async getCollection(): Promise<Collection<ProductDocument>> {
        try {
            const client = await getMongoClient(this.connectionString); // Get or create client
            const db = client.db(this.dbName);
            return db.collection<ProductDocument>(this.collectionName);
        } catch (error: any) { // Catch potential error from getMongoClient
            console.error("Error getting MongoDB collection:", error);
            throw new Error(`Could not get database collection: ${error.message}`);
        }
    }


    /**
     * Fetches detailed product info (nutrients, image) from Open Food Facts API.
     */
    private async fetchProductDetailsFromApi(code: string): Promise<OffApiResponse['product'] | null> {
        // *** REMOVED nutriscore_grade from fields requested from API ***
        const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,product_name_en,image_front_url,image_url,nutriments`;
        try {
            const response = await axios.get<OffApiResponse>(url, { timeout: 5000 });
            if (response.data?.status === 1 && response.data.product) {
                return response.data.product;
            }
            return null;
        } catch (error) {
            // console.error(`Error fetching details for code ${code}:`, error.message);
            return null;
        }
    }

    /**
     * Gets food recommendations based on a nutrient deficiency.
     */
    async getRecommendations(deficiencyName: string, limit: number = 5): Promise<AIServiceResult<FoodRecommendation[]>> {
        console.log(`Getting recommendations for deficiency: ${deficiencyName}`);
        const lowerCaseDeficiency = deficiencyName.toLowerCase().trim();
        const nutrientBaseName = this.nutrientNameMap[lowerCaseDeficiency];

        if (!nutrientBaseName) {
            console.warn(`No mapping found for deficiency: ${deficiencyName}`);
            return { success: false, error: `Nutrient mapping not found for "${deficiencyName}".` };
        }
        const nutrientValueField = `${nutrientBaseName}_100g`;
        const nutrientUnitField = `${nutrientBaseName}_unit`;
        console.log(`Mapped to base nutrient: ${nutrientBaseName}. Expecting fields: ${nutrientValueField}, ${nutrientUnitField}`);

        try {
            const collection = await this.getCollection();

            // *** Filter includes 'a', 'b', 'c' ***
            const initialQuery = { nutriscore_grade: { $in: ['a', 'b', 'c'] } };
            const initialLimit = limit * 5; // Fetch more candidates initially
            console.log(`Querying MongoDB for up to ${initialLimit} candidates with Nutri-Score A/B/C...`);
            const candidates = await collection
                .find(initialQuery)
                .limit(initialLimit)
                // *** REMOVED nutriscore_grade from projection ***
                .project<{ code: string; name: string }>({ _id: 0, code: 1, name: 1 })
                .toArray();

            console.log(`Found ${candidates.length} initial candidates in MongoDB.`);
            if (candidates.length === 0) {
                return { success: true, data: [] };
            }

            console.log(`Fetching details from Open Food Facts API for ${candidates.length} candidates...`);
            const detailedCandidates: FoodRecommendation[] = [];
            for (const candidate of candidates) {
                const productDetails = await this.fetchProductDetailsFromApi(candidate.code);
                if (productDetails?.nutriments) {
                    const nutrientValue = productDetails.nutriments[nutrientValueField] as number | undefined;
                    const unit = productDetails.nutriments[nutrientUnitField] as string | undefined;
                    if (nutrientValue !== undefined && nutrientValue > 0) {
                        detailedCandidates.push({
                            code: candidate.code,
                            name: productDetails.product_name_en || productDetails.product_name || candidate.name,
                            imageURL: productDetails.image_front_url || productDetails.image_url,
                            nutrientValue: nutrientValue,
                            unit: unit,
                            // *** REMOVED nutriscore_grade from result object ***
                        });
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 50)); // API delay
            }
            console.log(`Successfully fetched details for ${detailedCandidates.length} candidates with positive nutrient values for ${nutrientBaseName}.`);

            // Sort only by nutrient value (descending)
            detailedCandidates.sort((a, b) => (b.nutrientValue ?? 0) - (a.nutrientValue ?? 0));

            const finalRecommendations = detailedCandidates.slice(0, limit);

            console.log(`Returning top ${finalRecommendations.length} recommendations for ${deficiencyName}.`);
            return { success: true, data: finalRecommendations };

        } catch (error: any) {
            console.error(`Error in getRecommendations for ${deficiencyName}:`, error);
            return {
                success: false,
                error: `Failed to fetch recommendations: ${error.message}`
            };
        }
    }
}

// Import necessary libraries
const fs = require('fs');
const csv = require('csv-parser');
const { MongoClient } = require('mongodb');

// --- CONFIGURATION - EDIT THESE VALUES ---
const csvFilePath = 'C:/Users/josue/Desktop/New folder (2)/filtered_food_data.csv'; // Use forward slashes
const mongoConnectionString = 'mongodb+srv://josuevillalona:xrQQDocK3Bd4L5vV@cluster0.tooobky.mongodb.net/?retryWrites=true&w=majority'; // Connection string
const dbName = 'openfoodfacts'; // Database name
const collectionName = 'products'; // Collection name
const batchSize = 500; // Insert documents in batches
// --- END CONFIGURATION ---

// Define the main asynchronous function that holds all the logic
async function main() { // <--- Make sure this function definition exists
    console.log('Starting CSV to MongoDB loading process...');
    console.time('Total Loading Time');

    // Basic placeholder check (ensure password isn't the literal '<password>')
    if (mongoConnectionString.includes('<password>')) {
        console.error("ERROR: Update mongoConnectionString placeholder!");
        process.exit(1);
    }
    // Check if CSV file exists using the configured path
    if (!fs.existsSync(csvFilePath)) {
        console.error(`ERROR: CSV file not found at path: ${csvFilePath}`);
        process.exit(1);
    }

    let mongoClient;
    let documentsBuffer = [];
    let processedCount = 0;
    let insertedCount = 0;

    try {
        // --- Connect to MongoDB ---
        console.log('Connecting to MongoDB Atlas...');
        mongoClient = new MongoClient(mongoConnectionString);
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        const collection = db.collection(collectionName);
        console.log(`Connected to MongoDB Atlas. Database: ${dbName}, Collection: ${collectionName}`);

        // --- Optional: Clear existing data ---
        // console.log(`Clearing existing data from ${collectionName}...`);
        // await collection.deleteMany({});
        // console.log('Existing data cleared.');

        // --- Read CSV and Insert in Batches ---
        console.log(`Reading CSV file: ${csvFilePath}`);
        console.time('CSV Read and Insert Time');

        // Create a readable stream from the CSV file and pipe it through the CSV parser
        const stream = fs.createReadStream(csvFilePath).pipe(csv());

        // Process each row from the CSV stream asynchronously
        for await (const row of stream) {
            processedCount++;
            const doc = processCsvRow(row); // Process/clean the row data
            if (doc) {
                documentsBuffer.push(doc);
            }

            // Insert batch if buffer reaches size
            if (documentsBuffer.length >= batchSize) {
                const count = await insertBatch(collection, documentsBuffer);
                insertedCount += count;
                documentsBuffer = []; // Clear buffer
            }

            if (processedCount % 5000 === 0) { // Log progress every 5000 rows
                console.log(`Processed ${processedCount} rows from CSV... Inserted approx ${insertedCount}`);
            }
        }

        // Insert any remaining documents after the stream ends
        if (documentsBuffer.length > 0) {
            console.log(`Inserting final batch of ${documentsBuffer.length} documents...`);
            const count = await insertBatch(collection, documentsBuffer);
            insertedCount += count;
        }

        console.timeEnd('CSV Read and Insert Time');
        console.log(`Finished processing CSV. Total rows processed: ${processedCount}. Total documents likely inserted: ${insertedCount}`);

        // Optional: Add index for faster queries later
        console.log('Attempting to create index on "code"...');
        try {
            await collection.createIndex({ code: 1 }, { unique: true }); // Unique index on product code
            console.log('Index on "code" created successfully.');
        } catch (indexError) {
            if (indexError.codeName !== 'IndexAlreadyExists' && indexError.code !== 85 /* IndexOptionsConflict */ && indexError.code !== 86 /* IndexKeySpecsConflict */) {
                console.warn("Could not create index on 'code' (might already exist or other issue):", indexError.message);
            } else {
                console.log("Index on 'code' likely already exists or non-unique keys were inserted.");
            }
        }

    } catch (error) {
        console.error('An error occurred during the loading process:', error);
    } finally {
        // --- Cleanup: Ensure MongoDB connection is closed ---
        console.log('Closing MongoDB connection...');
        if (mongoClient) {
            await mongoClient.close();
            console.log("MongoDB connection closed.");
        }
        console.timeEnd('Total Loading Time');
    }
} // <--- Make sure this closing brace for the main function exists

// Helper function to process a row from CSV
function processCsvRow(row) {
    if (!row || !row.code) return null; // Skip empty rows or rows without code
    try {
        let productNameEn = 'Unknown Name'; // Default name
        if (row.product_name) {
            try {
                // Attempt to parse if it looks like the multilingual struct string representation
                if (row.product_name.startsWith('[')) {
                    const nameArray = JSON.parse(row.product_name.replace(/""/g, '"').replace(/^"|"$/g, '')); // Handle potential extra quotes
                    const nameObj = nameArray.find(n => n.lang === 'en') || nameArray.find(n => n.lang === 'main') || nameArray[0];
                    if (nameObj && nameObj.text) productNameEn = nameObj.text.trim();
                } else {
                    // Assume it's a simple string if not starting with '['
                    productNameEn = row.product_name.trim();
                }
            } catch (nameParseError) {
                console.warn(`Could not parse product_name for code ${row.code}. Using raw value or default. Value: ${row.product_name}`);
                productNameEn = row.product_name.trim(); // Fallback to raw string
            }
        }

        const mongoDoc = {
            code: row.code.trim(),
            name: productNameEn,
            categories_tags: parseStringArray(row.categories_tags), // Use helper
            nutriscore_grade: row.nutriscore_grade?.toLowerCase().trim() || 'unknown',
        };

        // Add nutrient columns if they exist, parsing them as floats
        Object.keys(row).forEach(key => {
            // Use the alias names we expect from the CSV header (e.g., 'energy_kcal_100g')
            if (!['code', 'product_name', 'categories_tags', 'nutriscore_grade'].includes(key)) {
                if (row[key] !== null && row[key] !== '') { // Check if value exists
                    const value = parseFloat(row[key]);
                    if (!isNaN(value)) {
                        mongoDoc[key] = value;
                    }
                }
            }
        });
        return mongoDoc;

    } catch (e) {
        console.error(`Error processing CSV row data for code ${row.code}:`, e);
        return null; // Skip rows that cause processing errors
    }
}

// Helper function to parse string representation of arrays (like '["tag1","tag2"]')
function parseStringArray(str) {
    if (!str || typeof str !== 'string' || str.toLowerCase() === 'null') return [];
    try {
        // DuckDB COPY TO CSV for list/struct might produce non-standard JSON string, handle common cases
        let cleanStr = str.trim();
        if (cleanStr.startsWith('[') && cleanStr.endsWith(']')) {
            // Try parsing as JSON array after cleaning potential escape issues
            try {
                const arr = JSON.parse(cleanStr.replace(/^\["|"\]$/g, '').replace(/""/g, '"').replace(/','/g, '","'));
                return Array.isArray(arr) ? arr : [cleanStr]; // Fallback to raw string in array if parse result isn't array
            } catch (jsonErr) {
                // Fallback for simple comma-separated lists within brackets that aren't valid JSON
                return cleanStr.substring(1, cleanStr.length - 1).split(',').map(s => s.trim()).filter(s => s.length > 0);
            }
        } else {
            // Assume comma-separated if not bracketed
            return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
        }
    } catch (e) {
        console.warn(`Could not parse array string: "${str}"`, e);
        return [str]; // Return original string in an array as fallback
    }
}


// Helper function to insert a batch of documents
async function insertBatch(collection, batch) {
    if (batch.length === 0) return 0;
    try {
        const result = await collection.insertMany(batch, { ordered: false });
        return result.insertedCount || 0;
    } catch (error) {
        let successfulWrites = 0;
        // Check if the error object and its properties exist before accessing them
        if (error && (error.code === 11000 || (error.result && error.result.writeErrors))) {
            successfulWrites = error.result?.nInserted || 0;
            console.warn(`Warning: Batch insert encountered errors (duplicates or other). ${successfulWrites} documents might have been inserted.`);
            // Log only the first few errors to avoid flooding console
            if (error.writeErrors) {
                // console.warn(`Write Error Summary: ${JSON.stringify(error.writeErrors.slice(0, 2))}...`);
            }
        } else {
            // Log unexpected errors fully
            console.error('Unexpected Error inserting batch:', error);
        }
        return successfulWrites; // Return count potentially inserted despite errors
    }
}

// Run the main function defined above
main(); // <-- Make sure this line exists at the very end
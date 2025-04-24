// Import necessary libraries
const duckdb = require('duckdb');
const { MongoClient } = require('mongodb');

// --- CONFIGURATION - EDIT THESE VALUES ---
const parquetFilePath = 'C:/Users/josue/Downloads/food.parquet'; // Path to your downloaded Parquet file
const mongoConnectionString = 'mongodb+srv://josuevillalona:xrQQDocK3Bd4L5vV@cluster0.tooobky.mongodb.net/?retryWrites=true&w=majority'; // Replace with your Atlas connection string
const dbName = 'openfoodfacts'; // Name for your database in Atlas
const collectionName = 'products'; // Name for the collection to store food data

// --- Filtering Criteria ---
const targetNutriScores = ['a', 'b']; // Keep only A and B grades
const targetCountryTag = 'en:us'; // Keep only US products (adjust if needed, or remove the filter)

// --- Nutrient Columns to Select (IMPORTANT: Verify/Update these names later!) ---
const nutrientColumnsSQL = `
    nutriments."energy-kcal_100g" AS energy_kcal_100g,
    nutriments."fat_100g" AS fat_100g,
    nutriments."saturated-fat_100g" AS saturated_fat_100g,
    nutriments."carbohydrates_100g" AS carbohydrates_100g,
    nutriments."sugars_100g" AS sugars_100g,
    nutriments."fiber_100g" AS fiber_100g,
    nutriments."proteins_100g" AS proteins_100g,
    nutriments."salt_100g" AS salt_100g,
    nutriments."sodium_100g" AS sodium_100g,
    nutriments."vitamin-a_100g" AS vitamin_a_100g,
    nutriments."vitamin-c_100g" AS vitamin_c_100g,
    nutriments."vitamin-d_100g" AS vitamin_d_100g,
    nutriments."vitamin-e_100g" AS vitamin_e_100g,
    nutriments."vitamin-k_100g" AS vitamin_k_100g,
    nutriments."vitamin-b1_100g" AS vitamin_b1_100g,
    nutriments."vitamin-b2_100g" AS vitamin_b2_100g,
    nutriments."vitamin-pp_100g" AS vitamin_pp_100g,
    nutriments."vitamin-b6_100g" AS vitamin_b6_100g,
    nutriments."vitamin-b9_100g" AS vitamin_b9_100g,
    nutriments."folates_100g" AS folates_100g,
    nutriments."vitamin-b12_100g" AS vitamin_b12_100g,
    nutriments."calcium_100g" AS calcium_100g,
    nutriments."phosphorus_100g" AS phosphorus_100g,
    nutriments."iron_100g" AS iron_100g,
    nutriments."magnesium_100g" AS magnesium_100g,
    nutriments."zinc_100g" AS zinc_100g,
    nutriments."copper_100g" AS copper_100g,
    nutriments."manganese_100g" AS manganese_100g,
    nutriments."selenium_100g" AS selenium_100g,
    nutriments."iodine_100g" AS iodine_100g
`;
// --- END CONFIGURATION ---


// Main async function wrapper
async function main() {
    console.log('Starting data loading process...');
    console.time('Total Loading Time'); // Start timer

    // Ensure placeholders are replaced
    if (mongoConnectionString.includes('<password>') || mongoConnectionString.includes('<username>') || mongoConnectionString.includes('clustername')) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!! ERROR: Please replace placeholders in mongoConnectionString!");
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        process.exit(1);
    }
    if (parquetFilePath.includes('REPLACE_WITH') || !parquetFilePath.endsWith('food.parquet')) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error(`!!! ERROR: The path "${parquetFilePath}" looks incorrect. Please edit the script!`);
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        process.exit(1);
    }
    const sqlFriendlyPath = parquetFilePath.replace(/\\/g, '/');

    let duckDB;
    let mongoClient;

    try {
        // --- Connect to DuckDB ---
        console.log('Connecting to DuckDB...');
        duckDB = new duckdb.Database(':memory:');
        const con = duckDB.connect();
        console.log('DuckDB connected.');

        // --- Connect to MongoDB ---
        console.log('Connecting to MongoDB Atlas...');
        mongoClient = new MongoClient(mongoConnectionString);
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        const mongoCollection = db.collection(collectionName);
        console.log(`Connected to MongoDB Atlas. Database: ${dbName}, Collection: ${collectionName}`);

        // --- Construct DuckDB Query ---
        const query = `
            SELECT
                code,
                product_name,
                categories_tags,
                nutriscore_grade,
                ${nutrientColumnsSQL}
            FROM read_parquet('${sqlFriendlyPath}')
            WHERE nutriscore_grade IN (${targetNutriScores.map(s => `'${s}'`).join(', ')})
            AND array_contains(countries_tags, '${targetCountryTag}')
            ;
        `;
        console.log('Constructed DuckDB query. Starting processing using con.each()...');
        // console.log("Full SQL Query:\n", query); // Uncomment to see the full query

        // --- Process Data using con.each ---
        let documentsBuffer = [];
        const batchSize = 1000;
        let processedCount = 0;
        let insertedCount = 0;
        let hasErrorInEach = false;
        console.time('DuckDB Query & Processing Time');

        // Wrap con.each in a Promise to await its completion or error
        await new Promise((resolve, reject) => {
            // --- ADDED Log before Promise ---
            console.log('DEBUG: About to create Promise wrapping con.each...');
            // --- END Log ---

            try { // <-- Added try around con.each call
                // --- ADDED Log inside Promise ---
                console.log('DEBUG: Inside Promise executor, calling con.each...');
                // --- END Log ---

                con.each(query,
                    (err, row) => { // Row callback
                        // --- ADDED Log inside Row Callback ---
                        // Only log occasionally to avoid flooding console
                        if (processedCount === 0 || processedCount % 1000 === 0) {
                            console.log(`DEBUG: Row callback executed for row approx #${processedCount + 1}. Err status: ${!!err}`);
                        }
                        // --- END Log ---
                        if (hasErrorInEach) return; // Stop processing if fatal error occurred
                        if (err) {
                            console.error('Error processing row:', err);
                            hasErrorInEach = true; // Set flag
                            return; // Skip row
                        }
                        processedCount++;
                        const doc = processRow(row);
                        if (doc) {
                            documentsBuffer.push(doc);
                        }

                        if (documentsBuffer.length >= batchSize) {
                            const batchToInsert = [...documentsBuffer];
                            documentsBuffer = [];
                            // Fire-and-forget insert, log errors but continue processing rows
                            insertBatch(mongoCollection, batchToInsert)
                                .then(count => insertedCount += count)
                                .catch(e => {
                                    console.error("Async Batch insert failed (processing continues):", e);
                                    // Potentially set hasErrorInEach = true here too if needed
                                });
                        }

                        if (processedCount % 10000 === 0) {
                            console.log(`Processed ${processedCount} rows from Parquet... Current inserted count (may be lagging): ${insertedCount}`);
                        }
                    },
                    async (err, totalRowCount) => { // Final callback
                        // --- ADDED Log inside Final Callback ---
                        console.log('DEBUG: Final con.each callback executed.');
                        // --- END Log ---
                        console.timeEnd('DuckDB Query & Processing Time');
                        if (err || hasErrorInEach) {
                            console.error(`Error executing main query with con.each or during row processing: ${err || 'Error occurred in row callback'}`);
                            // Attempt final batch insert even on error
                            if (documentsBuffer.length > 0) {
                                console.log(`Inserting final batch of ${documentsBuffer.length} documents before rejecting...`);
                                try {
                                    const count = await insertBatch(mongoCollection, documentsBuffer);
                                    insertedCount += count;
                                } catch (finalInsertErr) {
                                    console.error("Error inserting final batch after error:", finalInsertErr);
                                }
                            }
                            console.log(`Processing stopped due to error. Total documents likely inserted: ${insertedCount}`);
                            return reject(err || new Error('Error occurred during query or row processing.')); // Reject the promise
                        }

                        console.log(`Finished reading from Parquet. Total rows processed: ${totalRowCount}`);

                        // Insert any remaining documents
                        if (documentsBuffer.length > 0) {
                            console.log(`Inserting final batch of ${documentsBuffer.length} documents...`);
                            try {
                                const count = await insertBatch(mongoCollection, documentsBuffer);
                                insertedCount += count;
                                console.log(`Final batch inserted. Total documents likely inserted: ${insertedCount}`);
                                resolve(); // Resolve the promise on success
                            } catch (finalInsertErr) {
                                console.error("Error inserting final batch:", finalInsertErr)
                                reject(finalInsertErr); // Reject on final batch error
                            }
                        } else {
                            console.log(`No remaining documents to insert. Total documents likely inserted: ${insertedCount}`);
                            resolve(); // Resolve if buffer was empty
                        }
                    }
                );
                // --- ADDED Log after calling con.each ---
                console.log('DEBUG: con.each function call finished (but might be running async).');
                // --- END Log ---
            } catch (syncError) { // <-- Added catch block
                console.error("DEBUG: Synchronous error caught around con.each call!", syncError);
                reject(syncError); // Reject the promise if an immediate error occurs
            }
        }); // End Promise for con.each

        // --- ADDED Log after Promise ---
        console.log('DEBUG: Promise wrapping con.each finished.');
        // --- END Log ---

        console.log('Data loading script finished processing successfully.');

    } catch (error) {
        console.error('An error occurred outside the con.each loop:', error);
    } finally {
        // --- Cleanup ---
        console.log('Closing connections...');
        if (duckDB) {
            try {
                duckDB.close();
                console.log("DuckDB connection closed.");
            } catch (e) { console.error("Error closing duckdb", e) }
        }
        if (mongoClient) {
            await mongoClient.close();
            console.log("MongoDB connection closed.");
        }
        console.timeEnd('Total Loading Time');
    }
}

// Helper function to process a row from DuckDB
function processRow(row) {
    if (!row) return null;
    try {
        let productNameEn = null;
        if (row.product_name && Array.isArray(row.product_name)) {
            const nameObj = row.product_name.find(n => n.lang === 'en') || row.product_name.find(n => n.lang === 'main') || row.product_name[0];
            if (nameObj && nameObj.text) {
                productNameEn = nameObj.text;
            }
        }
        if (!productNameEn) {
            // console.warn(`Skipping row with code ${row.code} due to missing English product name.`);
            return null;
        }

        const mongoDoc = {
            code: row.code,
            name: productNameEn,
            categories_tags: row.categories_tags || [],
            nutriscore_grade: row.nutriscore_grade,
            ...Object.fromEntries(
                Object.entries(row).filter(([key]) => !['code', 'product_name', 'categories_tags', 'nutriscore_grade'].includes(key))
            )
        };
        // Clean out null nutrient values before insertion if desired
        for (const key in mongoDoc) {
            if (mongoDoc[key] === null) {
                delete mongoDoc[key];
            }
        }
        return mongoDoc;
    } catch (e) {
        console.error("Error processing row data:", row, e);
        return null;
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
        if (error.code === 11000 || (error.result && error.result.writeErrors)) {
            successfulWrites = error.result?.nInserted || 0;
            console.warn(`Warning: Batch insert encountered errors (duplicates or other). ${successfulWrites} documents might have been inserted.`);
            // Log only the first few errors to avoid flooding
            if (error.writeErrors) {
                // console.warn(`Write Error Summary: ${JSON.stringify(error.writeErrors.slice(0, 2))}...`);
            }
        } else {
            console.error('Error inserting batch:', error);
        }
        return successfulWrites;
    }
}

// Run the main function
main();
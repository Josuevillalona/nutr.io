// Import the duckdb library
const duckdb = require('duckdb');

// --- IMPORTANT: SET THE PATH TO YOUR DOWNLOADED FILE ---
const parquetFilePath = 'C:/Users/josue/Downloads/food.parquet'; // <-- DOUBLE CHECK THIS LINE!
// --- END IMPORTANT ---

if (parquetFilePath.includes('REPLACE_WITH') || !parquetFilePath.endsWith('food.parquet')) {
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error(`!!! ERROR: The path "${parquetFilePath}" looks incorrect. Please edit explore_parquet.js and set the correct full path to your food.parquet file!`);
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    process.exit(1);
}
const sqlFriendlyPath = parquetFilePath.replace(/\\/g, '/');

const db = new duckdb.Database(':memory:', (err) => {
    if (err) {
        console.error("Error creating DuckDB database:", err);
        return;
    }
    console.log("DuckDB database created.");

    const con = db.connect();
    console.log("Connected to DuckDB.");

    // Query 1: Still useful to see column types
    const describeQuery = `DESCRIBE SELECT * FROM read_parquet('${sqlFriendlyPath}');`;

    // Query 2: Extract distinct nutrient names using UNNEST
    const selectQuery = `
      SELECT DISTINCT n.name
      FROM (
          -- Subquery to limit initial rows read from the large parquet file
          SELECT nutriments
          FROM read_parquet('${sqlFriendlyPath}')
          WHERE nutriments IS NOT NULL -- Ensure the nutriments array exists
          LIMIT 5000 -- Process nutriments from the first 5000 rows with data
      ) AS subquery, UNNEST(subquery.nutriments) AS t(n) -- Unnest the array
      ORDER BY n.name; -- Sort the names alphabetically
    `;

    // ---- Query 1: Show Column Names and Types ----
    console.log("\n--- Getting Column Names and Types ---");
    console.log("Running Query:", describeQuery);
    con.all(describeQuery, (err, res) => {
        if (err) {
            console.error("Error running DESCRIBE query:", err);
        } else {
            console.log("Columns Found:");
            console.table(res); // Display results in a table format
        }

        // ---- Query 2: Show the distinct nutrient names ----
        console.log("\n--- Getting Distinct Nutrient Names ---"); // Updated heading
        console.log("Running Query:", selectQuery);
        con.all(selectQuery, (err, res) => { // Using con.all as the result set should be manageable
            if (err) {
                console.error("Error running SELECT DISTINCT nutrient names query:", err);
            } else {
                // --- Diagnostic Logging ---
                console.log("Distinct Nutrient Names Query Successful");
                console.log("Type of result 'res':", typeof res);
                console.log("Is 'res' an array?", Array.isArray(res));
                console.log("Number of distinct names found:", Array.isArray(res) ? res.length : 'N/A');

                // --- Logging the Names ---
                console.log("--- Distinct Nutrient Names Found ---");
                if (Array.isArray(res)) {
                    // Each element in 'res' should be an object like { name: 'nutrient-name' }
                    res.forEach((item, index) => {
                        console.log(item.name); // Print just the nutrient name string
                    });
                } else {
                    console.log("Result 'res' is not an array or is empty.");
                }
                console.log("--- End of Nutrient Names ---");
            }

            // ---- Clean up ----
            console.log("\nClosing connection...");
            con.close((err) => {
                if (err) console.error("Error closing connection:", err);
            });
            db.close((err) => {
                if (err) console.error("Error closing database:", err);
                else console.log("Database closed.");
            });
        }); // End SELECT query callback
    }); // End DESCRIBE query callback
}); // End DB creation callback
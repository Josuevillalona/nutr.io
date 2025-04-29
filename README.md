# LONA

**AI-powered nutritional insights from your lab reports.**

LONA allows users to upload lab reports (PDF or image format) and receive AI-driven summaries, potential nutritional deficiency identifications, and relevant food recommendations sourced from Open Food Facts.

## Tech Stack

* **Framework:** Next.js (v15+, App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Frontend:** React ('use client'), Axios (for API calls), next/image
* **Backend:** Next.js API Routes (Node.js runtime)
* **Document Processing (OCR):** Google Cloud Document AI
* **Analysis & Structured Output:** OpenAI GPT-4o
* **Database:** MongoDB Atlas (Free Tier) - Stores filtered subset of Open Food Facts data & planned user data.
* **Live Food Data:** Open Food Facts API (v2)
* **Planned Hosting:** Vercel

*(Data Processing Setup Tools: DuckDB CLI, Node.js script w/ csv-parser, mongodb driver)*

## Key Features Implemented

* **File Upload:** Accepts PDF, JPG, PNG lab report files via frontend component (`FileUpload.tsx`).
* **OCR Processing:** Extracts text from uploaded documents using Google Cloud Document AI via backend service (`DocumentAIService`).
* **AI Analysis:** Sends extracted text to OpenAI GPT-4o (`OpenAIService`) to get a summary and list of potential deficiencies in structured JSON format (`LabAnalysisResult`).
* **Food Recommendations:**
    * Identifies candidate foods from a local MongoDB collection (filtered Open Food Facts data) based on basic criteria (e.g., Nutri-Score A/B/C) (`LocalFoodDataService`).
    * Fetches live details (nutrients, image URL) for candidates from the Open Food Facts API v2.
    * Filters and ranks foods based on the presence and amount of the target nutrient for each identified deficiency.
    * Displays top recommendations with images and names.
    * Recommendation cards are clickable, linking to the product page on Open Food Facts.
* **Grocery List:**
    * Users can add/remove recommended food items to a personal grocery list.
    * The grocery list persists between page loads using browser `localStorage`.
    * Items in the grocery list are clickable, linking to Open Food Facts.
* **UI Layout:**
    * Implemented a fixed left sidebar layout (`Sidebar.tsx`, `layout.js`) for navigation (links currently placeholders).
    * Includes the user's logo in the sidebar.
    * Main content area displays application views.
    * (Optional) Full-screen video background implemented in `layout.js` (with acknowledged UX feedback suggesting restriction to auth pages later).
    * Text elements (titles, loading state, specific headings) styled for visibility against video background.

## Core Workflow

1.  **Upload:** User uploads lab report via `FileUpload.tsx`.
2.  **Backend Request:** Frontend sends file to `/api/upload/route.ts`.
3.  **Orchestration:** API route uses `AIOrchestrationService`:
    * Calls `DocumentAIService` for OCR -> Extracts text.
    * Calls `OpenAIService` -> Gets structured analysis (summary, deficiencies).
4.  **Recommendation Generation:**
    * API route calls `LocalFoodDataService` for each deficiency.
    * Service queries MongoDB for candidates.
    * Service calls live OFF API for details of candidates.
    * Service filters, sorts, and returns top recommendations.
5.  **Response:** API route combines analysis and recommendations, sends back to frontend.
6.  **Display:** `FileUpload.tsx` displays summary, deficiencies, clickable recommendation cards, and the grocery list.

## Data Handling (Open Food Facts)

* Initial ~6GB Parquet dataset filtered using DuckDB CLI for US products (`code`, `product_name`, `categories_tags`, `nutriscore_grade`).
* Filtered data loaded into MongoDB Atlas `products` collection via Node.js script.
* Detailed nutrient data and current image URLs are fetched via **live** calls to the Open Food Facts API v2 during recommendation generation.

## Current Status & Known Issues

* **End-to-End Flow:** Functional from upload to display of analysis and recommendations.
* **Layout:** Sidebar layout structure implemented.
* **Features:** Grocery list (with persistence), clickable links implemented.
* **Performance:** **Significant bottleneck** in recommendation generation due to multiple sequential live API calls to Open Food Facts per deficiency. Addressed partially via client-side perception (loading states), but backend optimization/async processing is needed.
* **Authentication:** **Not implemented.** Currently, the app is not user-specific.
* **Navigation:** Sidebar links are placeholders; no routing implemented yet.
* **RAG/Educational Content:** Not implemented. Current AI analysis is direct GPT-4o call without a specific knowledge base.

## Planned Next Steps (Start of Phase 2)

The immediate next step is to begin implementing **Phase 2**, starting with:

1.  **User Authentication (FR1):** Implementing secure user registration/login using NextAuth.js (proposed). This involves database schema changes, backend logic, API routes, and frontend UI components.

*(Subsequent Phase 2 goals include RAG pipeline, user profile integration, educational content, UI integration for different views, and further performance/NFR work).*

## Running Locally

1.  **Clone the repository.**
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Set up Environment Variables:**
    * Create a `.env.local` file in the root directory.
    * Add the required API keys and configuration:
      ```
      # Google Cloud Document AI
      DOCUMENT_AI_PROCESSOR_ID=your-processor-id
      DOCUMENT_AI_LOCATION=your-gcp-location # e.g., us
      # GOOGLE_APPLICATION_CREDENTIALS=path/to/your/gcp-keyfile.json (Or configure ADC differently)

      # OpenAI
      OPENAI_API_KEY=your-openai-api-key

      # MongoDB
      MONGODB_CONNECTION_STRING="your-mongodb-atlas-connection-string"
      MONGODB_DB_NAME=openfoodfacts # Or your chosen DB name
      MONGODB_COLLECTION_NAME=products # Or your chosen collection name

      # NextAuth.js (when implemented)
      # NEXTAUTH_URL=http://localhost:3000 (or your deployment URL)
      # NEXTAUTH_SECRET=generate-a-secret # Use `openssl rand -base64 32`
      # GOOGLE_CLIENT_ID=... (if using Google provider)
      # GOOGLE_CLIENT_SECRET=...
      ```
4.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000) in your browser.
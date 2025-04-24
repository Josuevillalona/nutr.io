'use client';

import { useState } from 'react';
import axios from 'axios';

// Define interfaces for the expected response structure
// *** Ensure these match the definitions in app/services/ai/types.ts ***
interface DeficiencyDetail {
    nutrient: string;
    notes?: string;
}
interface LabAnalysisResult {
    summary: string;
    deficiencies: DeficiencyDetail[]; // Expecting array of objects now
}

interface FoodRecommendation {
    name: string;
    code: string;
    imageURL?: string;
    nutrientValue?: number;
    unit?: string;
    // nutriscore_grade?: string; // Grade is NOT included in this version
}

interface ApiResponseData {
    success: boolean;
    analysis: LabAnalysisResult;
    recommendations: { [key: string]: FoodRecommendation[] }; // Map deficiency name -> recommendations
    errors?: string[];
}

const maxDuration = 300; // Backend timeout in seconds

export default function FileUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ApiResponseData | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files ? e.target.files[0] : null;
        setFile(selectedFile);
        setError(null);
        setResult(null);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            console.log('Uploading file:', file.name, 'Type:', file.type);
            const response = await axios.post<ApiResponseData>('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: maxDuration * 1000
            });

            if (response.data.success) {
                console.log("API Response:", response.data);
                setResult(response.data);
                if (response.data.errors && response.data.errors.length > 0) {
                    console.warn("Errors fetching some recommendations:", response.data.errors);
                }
            } else {
                const responseData = response.data as any;
                throw new Error(responseData?.error || responseData?.details || 'API returned unsuccessful status');
            }
        } catch (err: any) {
            console.error('Upload failed:', err);
            let errorMessage = 'An error occurred while processing the file.';
            if (axios.isAxiosError(err)) {
                const responseData = err.response?.data as any;
                errorMessage = responseData?.details || responseData?.error || err.message;
                if (err.code === 'ECONNABORTED' || err.message.toLowerCase().includes('timeout')) {
                    errorMessage = `The request timed out after ${maxDuration} seconds. The file might be too large or processing is taking longer than expected. Please try again.`;
                }
            } else if (err instanceof Error) {
                errorMessage = err.message;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper function to render recommendations for a single deficiency
    const renderRecommendationsForDeficiency = (deficiencyName: string, recommendations: FoodRecommendation[]) => {
        // Use deficiencyName (string) to check recommendations map
        const recs = recommendations || []; // Ensure it's an array
        if (recs.length === 0) {
            // Message can be refined later
            return <p className="text-sm text-gray-600 italic">No specific food recommendations found for {deficiencyName}.</p>;
        }
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {recs.map((food) => (
                    // This version does NOT include the Nutri-Score badge
                    <div key={food.code} className="border rounded-lg p-3 shadow-sm bg-white text-center transition-shadow hover:shadow-md">
                        <img
                            src={food.imageURL || 'https://placehold.co/100x100/eee/ccc?text=No+Image'}
                            alt={`Image of ${food.name}`}
                            className="w-24 h-24 object-contain mx-auto mb-2 rounded"
                            loading="lazy"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = 'https://placehold.co/100x100/eee/ccc?text=Error';
                            }}
                        />
                        <p className="text-sm font-medium text-gray-800">{food.name}</p>
                    </div>
                ))}
            </div>
        );
    };

    // Main render function for results
    const renderResult = () => {
        if (!result || !result.analysis) return null;

        const { analysis, recommendations, errors } = result;

        return (
            <div className="mt-8 space-y-6">
                {/* Analysis Summary */}
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Analysis Summary</h3>
                    <div className="p-4 bg-blue-50 rounded-md border border-blue-100">
                        <p className="text-gray-700 whitespace-pre-wrap">{analysis.summary || "No summary provided."}</p>
                    </div>
                </div>

                {/* Deficiencies & Recommendations */}
                {Array.isArray(analysis.deficiencies) && analysis.deficiencies.length > 0 && (
                    <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">Potential Deficiencies & Food Recommendations</h3>
                        <div className="space-y-5">
                            {/* Use nutrient string for key and display */}
                            {analysis.deficiencies.map((deficiencyObj: DeficiencyDetail) => (
                                <div key={deficiencyObj.nutrient} className="p-4 bg-yellow-50 rounded-md border border-yellow-100">
                                    <h4 className="text-lg font-medium text-yellow-800 mb-3">{deficiencyObj.nutrient}</h4>
                                    {deficiencyObj.notes && <p className="text-sm text-yellow-700 mb-3 italic">{deficiencyObj.notes}</p>}
                                    {/* Pass the nutrient name string to get recommendations */}
                                    {renderRecommendationsForDeficiency(deficiencyObj.nutrient, recommendations?.[deficiencyObj.nutrient] || [])}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Display Errors */}
                {errors && errors.length > 0 && (
                    <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-md">
                        <h4 className="text-sm font-medium text-orange-700 mb-1">Recommendation Issues:</h4>
                        <ul className="list-disc list-inside text-sm text-orange-600">
                            {errors.map((errMsg, index) => <li key={index}>{errMsg}</li>)}
                        </ul>
                    </div>
                )}

                {/* Disclaimer */}
                <div className="mt-6 p-4 border-t border-gray-200 text-center">
                    <p className="text-xs text-gray-500">
                        Disclaimer: This information is AI-generated based on the uploaded document and public data. It is for informational purposes only and does not constitute medical advice. Consult with a qualified healthcare professional for any health concerns or before making any decisions related to your health or treatment. Food recommendations are based on available data and may not be exhaustive or suitable for all dietary restrictions.
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="file">
                        Upload Lab Report (PDF, JPG, or PNG)
                    </label>
                    <input
                        type="file"
                        id="file"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        accept=".pdf,.jpg,.jpeg,.png"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isLoading || !file}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                        </>
                    ) : 'Upload and Process'}
                </button>

                {error && (
                    <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-md">
                        <p className="text-red-700 text-sm font-medium">{error}</p>
                    </div>
                )}
            </form>

            {/* Render results section */}
            {result && renderResult()}
        </div>
    );
}

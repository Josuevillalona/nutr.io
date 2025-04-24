'use client';

import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';

// Define interfaces (assuming these match app/services/ai/types.ts)
interface DeficiencyDetail {
    nutrient: string;
    notes?: string;
}
interface LabAnalysisResult {
    summary: string;
    deficiencies: DeficiencyDetail[];
}

interface FoodRecommendation {
    name: string;
    code: string; // Unique identifier for the product
    imageURL?: string;
    nutrientValue?: number;
    unit?: string;
}

interface ApiResponseData {
    success: boolean;
    analysis: LabAnalysisResult;
    recommendations: { [key: string]: FoodRecommendation[] };
    errors?: string[];
}

const maxDuration = 300; // Backend timeout in seconds
const LOCAL_STORAGE_KEY = 'myHealthCompassGroceryList'; // Key for localStorage

export default function FileUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ApiResponseData | null>(null);
    const [backendErrors, setBackendErrors] = useState<string[]>([]);
    const [groceryList, setGroceryList] = useState<FoodRecommendation[]>([]);

    // Effect to load grocery list from localStorage on mount (no change)
    useEffect(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const savedList = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (savedList) {
                    const parsedList = JSON.parse(savedList);
                    if (Array.isArray(parsedList)) {
                        setGroceryList(parsedList);
                    } else {
                        localStorage.removeItem(LOCAL_STORAGE_KEY);
                    }
                }
            } catch (err) {
                console.error("Failed to load grocery list from localStorage:", err);
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        }
    }, []);

    // Effect to save grocery list to localStorage whenever it changes (no change)
    useEffect(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(groceryList));
            } catch (err) {
                console.error("Failed to save grocery list to localStorage:", err);
            }
        }
    }, [groceryList]);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // ... (function content remains the same) ...
        const selectedFile = e.target.files ? e.target.files[0] : null;
        if (selectedFile) {
            const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
            if (validTypes.includes(selectedFile.type)) {
                setFile(selectedFile);
                setError(null);
                setResult(null);
                setBackendErrors([]);
            } else {
                setError('Invalid file type. Please upload a PDF, JPG, or PNG file.');
                setFile(null);
                setResult(null);
                setBackendErrors([]);
            }
        } else {
            setFile(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        // ... (function content remains the same) ...
        e.preventDefault();
        if (!file) { setError("Please select a file first."); return; };
        setIsLoading(true);
        setError(null);
        setResult(null);
        setBackendErrors([]);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await axios.post<ApiResponseData>('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: (maxDuration + 60) * 1000
            });
            if (response.data.success) {
                setResult(response.data);
                if (response.data.errors && response.data.errors.length > 0) { setBackendErrors(response.data.errors); }
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
                    errorMessage = `The request timed out. The analysis might be taking too long or the file might be too large. Please try again.`;
                }
            } else if (err instanceof Error) { errorMessage = err.message; }
            setError(errorMessage);
            setResult(null);
        } finally { setIsLoading(false); }
    };

    // Handlers for Grocery List (remain the same)
    const handleAddToGroceryList = useCallback((foodToAdd: FoodRecommendation) => {
        // ... (function content remains the same) ...
        setGroceryList(prevList => {
            const exists = prevList.some(item => item.code === foodToAdd.code);
            if (!exists) { return [...prevList, foodToAdd]; }
            return prevList;
        });
    }, []);

    const handleRemoveFromGroceryList = useCallback((foodCodeToRemove: string) => {
        // ... (function content remains the same) ...
        setGroceryList(prevList => prevList.filter(item => item.code !== foodCodeToRemove));
    }, []);


    // Render recommendations card function (remains the same)
    const renderRecommendationsForDeficiency = (deficiencyName: string, recommendations: FoodRecommendation[]) => {
        // ... (function content is identical to previous version) ...
        const recs = recommendations || [];
        const hadBackendError = backendErrors.some(err => err.includes(deficiencyName));
        if (recs.length === 0) { return (<p className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-md"> {hadBackendError ? `Could not fetch recommendations for ${deficiencyName}.` : `No specific food recommendations found matching criteria for ${deficiencyName}.`} </p>); }
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {recs.map((food) => {
                    const isInList = groceryList.some(item => item.code === food.code);
                    const productUrl = `https://world.openfoodfacts.org/product/${food.code}`;
                    return (
                        <div key={food.code} className="group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-shadow hover:shadow-md">
                            <a href={productUrl} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                                {food.imageURL ? (<img src={food.imageURL} alt={food.name} className="w-full h-32 object-cover" loading="lazy" onError={(e) => { const target = e.target as HTMLImageElement; target.src = 'https://via.placeholder.com/150/eee/ccc?text=No+Image'; target.onerror = null; }} />) : (<div className="w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">No Image</div>)}
                                <div className="p-3 pt-2">
                                    <p className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-purple-700 transition-colors">{food.name}</p>
                                    {food.nutrientValue !== undefined && food.unit && (<p className="text-xs text-gray-500 mt-1">{`${food.nutrientValue} ${food.unit} / 100g`}</p>)}
                                </div>
                            </a>
                            <div className="p-3 pt-0 mt-auto">
                                <button onClick={(e) => { e.preventDefault(); handleAddToGroceryList(food); }} disabled={isInList} className={`w-full px-3 py-1 text-xs font-medium rounded transition-colors ${isInList ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`} > {isInList ? 'Added' : 'Add to List'} </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };


    // Render Results function (no change needed here)
    const renderResult = () => {
        // ... (function content is identical to previous version) ...
        if (!result || !result.analysis) return null;
        const { analysis, recommendations } = result;
        return (<div className="mt-8 space-y-8"> {analysis.summary && (<div className="p-6 bg-gray-50 rounded-lg shadow-sm border border-gray-200"> <h2 className="text-xl font-semibold text-gray-800 mb-3">Analysis Summary</h2> <p className="text-gray-700 whitespace-pre-wrap">{analysis.summary}</p> </div>)} <div> <h2 className="text-2xl font-bold text-gray-900 mb-5">Identified Deficiencies & Recommendations</h2> {(analysis.deficiencies && analysis.deficiencies.length > 0) ? (<div className="space-y-8"> {analysis.deficiencies.map((deficiencyObj) => (<div key={deficiencyObj.nutrient} className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm"> <h3 className="text-xl font-semibold text-gray-800 mb-1">{deficiencyObj.nutrient}</h3> {deficiencyObj.notes && <p className="text-sm text-gray-600 mb-4 italic">{deficiencyObj.notes}</p>} {renderRecommendationsForDeficiency(deficiencyObj.nutrient, recommendations?.[deficiencyObj.nutrient] || [])} </div>))} </div>) : (<p className="text-gray-600 italic p-4 bg-gray-50 rounded-md border">No specific deficiencies identified in the report.</p>)} </div> {backendErrors.length > 0 && (<div className="mt-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg"> <h4 className="text-sm font-semibold text-yellow-800 mb-1">Recommendation Issues:</h4> <ul className="list-disc list-inside text-sm text-yellow-700"> {backendErrors.map((errMsg, index) => <li key={index}>{errMsg}</li>)} </ul> </div>)} <div className="mt-10 pt-6 border-t border-gray-200"> <h3 className="text-md font-semibold text-gray-700 mb-2">Disclaimer</h3> <p className="text-sm text-gray-500"> This tool provides AI-generated insights...[rest of disclaimer]... </p> </div> </div>);
    };

    // --- UPDATED: Render Grocery List with Links ---
    const renderGroceryList = () => {
        if (groceryList.length === 0) { return null; }

        return (
            <div className="mt-12 p-6 bg-purple-50 rounded-lg border border-purple-200 shadow-sm">
                <h2 className="text-xl font-semibold text-purple-800 mb-4">My Grocery List ({groceryList.length})</h2>
                <ul className="space-y-3">
                    {groceryList.map((item) => {
                        // Construct the URL for the grocery list item
                        const productUrl = `https://world.openfoodfacts.org/product/${item.code}`;
                        return (
                            <li key={item.code} className="flex justify-between items-center p-3 bg-white rounded-md shadow-sm">
                                {/* Wrap item name in a link */}
                                <a
                                    href={productUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-gray-700 hover:text-purple-700 hover:underline"
                                >
                                    {item.name}
                                </a>
                                <button
                                    onClick={() => handleRemoveFromGroceryList(item.code)}
                                    className="ml-4 px-2 py-1 text-xs font-medium text-red-600 bg-red-100 rounded hover:bg-red-200 transition-colors flex-shrink-0" // Added flex-shrink-0
                                    aria-label={`Remove ${item.name} from list`}
                                >
                                    Remove
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    // Main component return (no change needed here)
    return (
        <div className="py-8">
            {/* ... Upload Form ... */}
            <form onSubmit={handleSubmit} className="mb-8 p-6 bg-white rounded-lg shadow-md border border-gray-200"> <label htmlFor="file-upload" className="block text-lg font-semibold text-gray-700 mb-3"> Upload Lab Report </label> <div className="flex flex-col sm:flex-row items-center gap-4"> <input id="file-upload" type="file" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-purple-500 focus:outline-none focus:ring-purple-500 sm:text-sm file:mr-4 file:rounded-md file:border-0 file:bg-purple-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-100" /> <button type="submit" disabled={isLoading || !file} className="w-full sm:w-auto flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap" > {isLoading ? (<> <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing... </>) : 'Analyze Report'} </button> </div> {file && <p className="text-sm text-gray-600 mt-3">Selected: {file.name}</p>} </form>
            {/* ... Loading State ... */}
            {isLoading && (<div className="text-center py-10"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div><p className="mt-4 text-gray-600">Analyzing your report, this may take a minute...</p></div>)}
            {/* ... Error Display ... */}
            {error && (<div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg"><p className="font-bold">Error</p><p>{error}</p></div>)}
            {/* ... Render results section ... */}
            {!isLoading && result && renderResult()}
            {/* ... Render Grocery List Section ... */}
            {!isLoading && renderGroceryList()}
        </div>
    );
}
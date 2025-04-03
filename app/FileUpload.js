'use client';

import { useState } from 'react';
import axios from 'axios';

export default function FileUpload() {
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        setError(null);
        setResult(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post('/api/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.success) {
                setResult(response.data.data);
            } else {
                throw new Error(response.data.error || 'Failed to process file');
            }
        } catch (err) {
            setError(err.message || 'An error occurred while processing the file');
            console.error('Upload failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2" htmlFor="file">
                        Upload Lab Report
                    </label>
                    <input
                        type="file"
                        id="file"
                        onChange={handleFileChange}
                        className="w-full px-3 py-2 border rounded-md"
                        accept=".pdf,.jpg,.jpeg,.png"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isLoading || !file}
                    className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
                >
                    {isLoading ? 'Processing...' : 'Upload and Process'}
                </button>

                {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-red-600 text-sm">{error}</p>
                    </div>
                )}

                {result && (
                    <div className="mt-6 space-y-4">
                        <h3 className="text-lg font-semibold">Results</h3>
                        <div className="p-4 bg-gray-50 rounded-md">
                            <div className="mb-2">
                                <span className="font-medium">Confidence Score: </span>
                                {(result.confidence * 100).toFixed(2)}%
                            </div>
                            <div>
                                <span className="font-medium">Extracted Text:</span>
                                <pre className="mt-2 whitespace-pre-wrap text-sm bg-white p-3 rounded border">
                                    {result.text}
                                </pre>
                            </div>
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
}

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

            console.log('Uploading file:', file.name, 'Type:', file.type);
            const response = await axios.post('/api/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.success) {
                setResult(response.data);
            } else {
                throw new Error(response.data.error || 'Failed to process file');
            }
        } catch (err) {
            console.error('Upload failed:', err);
            setError(err.response?.data?.details || err.message || 'An error occurred while processing the file');
        } finally {
            setIsLoading(false);
        }
    };

    const renderResult = () => (
        <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Analysis Results</h3>
            <div className="p-4 bg-gray-50 rounded-md space-y-4">
                {result.pageCount > 1 && (
                    <div>
                        <span className="font-medium text-gray-900">Pages Analyzed: </span>
                        {result.pageCount}
                    </div>
                )}
                <div>
                    <span className="font-medium text-gray-900">Analysis:</span>
                    <div className="mt-2 prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-white p-3 rounded border overflow-auto max-h-96">
                            {result.analysis}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );

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

                {result && renderResult()}
            </form>
        </div>
    );
}

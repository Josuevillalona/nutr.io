import FileUpload from './FileUpload';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          My Health Compass
        </h1>
        <p className="text-center text-gray-700 mb-8 max-w-2xl mx-auto">
          Upload your lab results to get AI-powered nutritional insights and food recommendations.
        </p>
        <FileUpload />
      </div>
    </div>
  );
}

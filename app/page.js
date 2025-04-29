// app/page.js (Replace H1 text with Logo Image)
import Image from 'next/image'; // Import the Image component
import FileUpload from './FileUpload';

export default function Home() {
  return (
    // Container div - background removed previously
    <div className="min-h-screen py-12">
      {/* Centering container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

        {/* --- Logo Image instead of H1 --- */}
        <div className="mb-6 flex justify-center"> {/* Centering div */}
          <Image
            src="/LONA White.png"
            alt="LONA Logo"
            width={240} // Adjust width as desired for main page logo size
            height={70} // Adjust height based on aspect ratio and desired size
            priority
          />
        </div>
        {/* --- End Logo --- */}

        {/* Subtitle */}
        <p className="text-lg text-gray-200 mb-12 max-w-2xl mx-auto [text-shadow:1px_1px_2px_rgba(0,0,0,0.6)]">
          Upload your lab results to get AI-powered nutritional insights and food recommendations.
        </p>

        {/* FileUpload Component */}
        <FileUpload />

      </div>
    </div>
  );
}
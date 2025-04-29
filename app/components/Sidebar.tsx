// app/components/Sidebar.tsx (With Logo Image)
'use client';

import React from 'react';
import Image from 'next/image'; // Import the next/image component
// import Link from 'next/link'; // Import later

const Sidebar = () => {
    // Placeholder for active state later
    const currentRoute = '/analyse'; // Example

    const menuItems = [
        { href: '/analyse', label: 'Analyse results' },
        { href: '/deficiencies', label: 'See Deficiencies' },
        { href: '/products', label: 'Food products' },
        { href: '/grocery-list', label: 'My grocery list' },
    ];

    return (
        // Sidebar container using custom color #2E3555
        <div className="w-64 h-screen bg-[#2E3555] text-gray-100 flex flex-col fixed top-0 left-0 z-10 border-r border-white/10">

            {/* --- UPDATED Logo Section --- */}
            <div className="p-4 h-16 flex items-center border-b border-white/10">
                {/* Replace placeholder with next/image */}
                <Image
                    // Use the web path relative to the 'public' folder
                    src="/LONA White.png"
                    alt="LONA" // Descriptive alt text
                    width={130} // Adjust width as needed based on your logo's aspect ratio
                    height={35} // Adjust height as needed (ensure it fits within h-16 container)
                    priority // Add priority if logo is critical for LCP (Largest Contentful Paint)
                // Add style={{ objectFit: 'contain' }} if aspect ratio needs preserving without distortion
                />
            </div>
            {/* --- End Logo Section --- */}


            {/* Navigation Menu */}
            <nav className="mt-4 flex-grow px-2">
                {menuItems.map((item) => (
                    // Replace 'a' with 'Link' later
                    <a
                        key={item.label}
                        href={item.href}
                        onClick={(e) => e.preventDefault()}
                        // Styling for menu items
                        className={`block py-2 px-3 rounded transition duration-150 font-medium ${currentRoute === item.href
                            ? 'bg-white/20 text-white' // Active state
                            : 'text-gray-300 hover:bg-white/10 hover:text-white' // Default and hover
                            }`}
                    >
                        {item.label}
                    </a>
                ))}
            </nav>

            {/* Optional: Footer or User Info Section */}
            <div className="p-4 border-t border-white/10">
                <p className="text-xs text-gray-400">© LONA</p>
            </div>
        </div>
    );
};

export default Sidebar;
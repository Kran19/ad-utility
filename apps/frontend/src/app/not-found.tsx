import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-6">
        <div className="w-16 h-16 bg-red-950/60 border border-red-800/80 rounded-2xl flex items-center justify-center mx-auto text-red-400 font-bold text-2xl">
          404
        </div>
        <h1 className="text-3xl font-bold text-white">Utility Not Found</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          The tool you are looking for does not exist, has been unpublished, or is currently undergoing maintenance.
        </p>
        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors shadow-lg hover:shadow-blue-500/25"
          >
            &larr; Back to All Utilities
          </Link>
        </div>
      </div>
    </main>
  );
}

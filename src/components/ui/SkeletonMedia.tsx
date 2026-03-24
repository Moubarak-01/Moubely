import React from 'react';

export const SkeletonMedia = ({ type = 'image' }: { type?: 'image' | 'video' }) => {
    return (
        <div className="relative w-full h-[140px] sm:h-[160px] rounded-2xl overflow-hidden bg-white/5 border border-white/10 animate-pulse">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skeleton-shimmer-bg" />

            <div className="absolute inset-0 flex items-center justify-center opacity-20">
                {type === 'image' ? (
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.587-1.587a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                ) : (
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                )}
            </div>

            <div className="absolute bottom-3 left-4 right-4 space-y-2">
                <div className="h-3 bg-white/10 rounded-full w-2/3" />
                <div className="h-2 bg-white/5 rounded-full w-1/3" />
            </div>

            <style>
                {`
          @keyframes skeleton-shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .skeleton-shimmer-bg {
            animation: skeleton-shimmer 2s infinite;
          }
        `}
            </style>
        </div>
    );
};

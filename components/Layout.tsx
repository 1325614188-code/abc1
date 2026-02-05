
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  onBack?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, title, onBack }) => {
  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-slate-50 relative shadow-xl">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-morphism px-4 py-4 flex items-center justify-between border-b border-pink-100">
        {onBack ? (
          <button onClick={onBack} className="p-2 -ml-2 text-pink-500 hover:bg-pink-50 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : (
          <div className="w-8"></div>
        )}
        <h1 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-rose-400 bg-clip-text text-transparent">
          {title}
        </h1>
        <div className="w-8"></div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 pb-20">
        {children}
      </main>

      {/* Decorative Bottom Bar */}
      {!onBack && (
        <nav className="fixed bottom-0 w-full max-w-md glass-morphism border-t border-pink-100 flex justify-around py-3 px-2 z-50">
          <div className="flex flex-col items-center text-pink-600">
            <span className="text-xl">🏠</span>
            <span className="text-xs">首页</span>
          </div>
          <div className="flex flex-col items-center text-slate-400">
            <span className="text-xl">👗</span>
            <span className="text-xs">试穿</span>
          </div>
          <div className="flex flex-col items-center text-slate-400">
            <span className="text-xl">💓</span>
            <span className="text-xs">美丽</span>
          </div>
          <div className="flex flex-col items-center text-slate-400">
            <span className="text-xl">🌿</span>
            <span className="text-xs">健康</span>
          </div>
        </nav>
      )}
    </div>
  );
};

export default Layout;

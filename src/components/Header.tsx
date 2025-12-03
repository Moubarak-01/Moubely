import React from 'react';
import { GripVertical, Eye, X } from 'lucide-react';

const Header: React.FC = () => {
  return (
    // The Container
    <div className="flex items-center justify-between px-4 py-3 select-none">
      
      {/* Left: Status Badge */}
      <div className="flex items-center gap-2 no-drag">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-full border border-white/5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">
            Active
          </span>
        </div>
      </div>

      {/* Center: DRAG HANDLE (Critical!) */}
      <div 
        className="draggable cursor-move active:cursor-grabbing p-2 hover:bg-white/5 rounded-lg transition-colors group"
      >
        <GripVertical size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 no-drag">
        <button 
          onClick={() => window.electronAPI.quitApp()}
          className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-md text-white/20 transition-all"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default Header;
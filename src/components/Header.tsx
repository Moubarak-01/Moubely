import React, { useState } from 'react';
import { GripVertical, Eye, X, Zap, ZapOff } from 'lucide-react'; // Added Zap icons for Live Mode

const Header: React.FC = () => {
  const [isLiveMode, setIsLiveMode] = useState(false);

  const toggleLiveMode = async () => {
    const newState = !isLiveMode;
    setIsLiveMode(newState);

    if (newState) {
      await window.electronAPI.invoke('start-live-mode');
    } else {
      await window.electronAPI.invoke('stop-live-mode');
    }
  };

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
        {/* LIVE MODE TOGGLE */}
        <button
          onClick={toggleLiveMode}
          className={`group flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all ${isLiveMode
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'
            }`}
        >
          {isLiveMode ? <Zap size={12} className="fill-current" /> : <ZapOff size={12} />}
          <span className="text-[10px] font-medium uppercase tracking-wider">
            {isLiveMode ? 'Live' : 'Off'}
          </span>
        </button>

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
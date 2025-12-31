import React, { useState } from 'react';

export const ProfileSettings: React.FC = () => {
  const [formData, setFormData] = useState({
    targetPersona: "High School Graduate",
    communicationStyle: "Analogy-Heavy",
    technicalDepth: "Beginner",
    keyExperiences: "Biology Research Intern, Tennis Athlete"
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      // Corrected to use the exposed electronAPI bridge
      const response = await window.electronAPI.saveUserProfile(formData);
      if (response.success) {
        alert("✅ Persona Saved! The AI will now act like this.");
      }
    } catch (error) {
      console.error(error);
      alert("❌ Failed to save profile.");
    }
  };

  return (
    <div className="p-6 text-white bg-gray-900 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">🧠 Digital Twin Settings</h2>
        <button 
          onClick={() => window.location.hash = "#/queue"}
          className="text-xs text-white/40 hover:text-white/80 transition-colors"
        >
          ← Back to Queue
        </button>
      </div>
      
      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block mb-1 font-semibold text-xs uppercase tracking-wider text-white/40">Target Persona</label>
          <input name="targetPersona" value={formData.targetPersona} onChange={handleChange} className="w-full p-2 rounded bg-black/10 border border-black/10 outline-none focus:border-blue-500/50 outline-none transition-colors" placeholder="e.g. Smart Student-Athlete" />
        </div>

        <div>
          <label className="block mb-1 font-semibold text-xs uppercase tracking-wider text-white/40">Communication Style</label>
          <select name="communicationStyle" value={formData.communicationStyle} onChange={handleChange} className="w-full p-2 rounded bg-black/10 border border-black/10 outline-none">
            <option value="Analogy-Heavy">Analogy-Heavy (Conversational)</option>
            <option value="Concise">Concise (Direct & Technical)</option>
            <option value="Academic">Academic (Formal)</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 font-semibold text-xs uppercase tracking-wider text-white/40">Technical Depth</label>
          <select name="technicalDepth" value={formData.technicalDepth} onChange={handleChange} className="w-full p-2 rounded bg-black/10 border border-black/10 outline-none">
            <option value="Beginner">Beginner (Explain like I'm 5)</option>
            <option value="Intermediate">Intermediate (Standard)</option>
            <option value="Expert">Expert (Skip basics)</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 font-semibold text-xs uppercase tracking-wider text-white/40">Key Experiences (Pivot Source)</label>
          <textarea name="keyExperiences" value={formData.keyExperiences} onChange={handleChange} className="w-full p-2 rounded bg-black/10 border border-black/10 outline-none h-24 outline-none resize-none" placeholder="e.g. Biology Research Intern, Tennis Captain" />
        </div>

        <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold transition-colors shadow-lg shadow-blue-900/20">
          Save Persona
        </button>
      </div>
    </div>
  );
};
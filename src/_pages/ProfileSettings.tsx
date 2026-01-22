import React, { useState, useEffect } from 'react';

// Interfaces for our data types
interface StoryMapping {
  id: string;
  storyName: string;
  keywords: string[];
  triggerPrompt: string;
}

interface UserProfile {
  targetPersona: string;
  communicationStyle: string;
  technicalDepth: string;
  keyExperiences: string;
  storyMappings: StoryMapping[];
}

export const ProfileSettings: React.FC = () => {
  const [formData, setFormData] = useState<UserProfile>({
    targetPersona: "High School Graduate",
    communicationStyle: "Analogy-Heavy",
    technicalDepth: "Beginner",
    keyExperiences: "Biology Research Intern, Tennis Athlete",
    storyMappings: []
  });

  const [activeTab, setActiveTab] = useState<'persona' | 'stories'>('persona');
  const [editingStory, setEditingStory] = useState<StoryMapping | null>(null);

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await window.electronAPI.getUserProfile();
        if (profile) {
          // Merge loaded profile with defaults to ensure all fields exist
          // Default to empty array if storyMappings is undefined
          setFormData(prev => ({
            ...prev,
            ...profile,
            storyMappings: Array.isArray(profile.storyMappings) ? profile.storyMappings : []
          }));
        }
      } catch (e) {
        console.error("Failed to load profile", e);
      }
    };
    loadProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      const response = await window.electronAPI.saveUserProfile(formData);
      if (response.success) {
        alert("✅ Persona & Stories Saved! The AI will now act like this.");
      }
    } catch (error) {
      console.error(error);
      alert("❌ Failed to save profile.");
    }
  };

  // --- STORY EDITOR LOGIC ---

  const handleStoryChange = (field: keyof StoryMapping, value: string) => {
    if (!editingStory) return;

    if (field === 'keywords') {
      // split by commas
      setEditingStory({ ...editingStory, keywords: value.split(',').map(s => s.trim()) });
    } else {
      setEditingStory({ ...editingStory, [field]: value });
    }
  };

  const saveExampleStory = () => {
    if (!editingStory) return;

    const newMappings = [...formData.storyMappings];
    const existingIndex = newMappings.findIndex(s => s.id === editingStory.id);

    if (existingIndex >= 0) {
      newMappings[existingIndex] = editingStory;
    } else {
      newMappings.push(editingStory);
    }

    setFormData({ ...formData, storyMappings: newMappings });
    setEditingStory(null); // Close editor
  };

  const deleteStory = (id: string) => {
    if (confirm("Are you sure you want to delete this story?")) {
      setFormData({ ...formData, storyMappings: formData.storyMappings.filter(s => s.id !== id) });
    }
  };

  const createNewStory = () => {
    setEditingStory({
      id: Date.now().toString(),
      storyName: "New Story",
      keywords: [],
      triggerPrompt: "🎯 MANDATORY STORY SELECTION:\nYou MUST tell the [STORY NAME] story.\n\n📖 NARRATIVE STRUCTURE:\n1. THE CONFLICT: \"...\"\n2. THE ANALOGY: \"It was like...\"\n3. THE RESOLUTION: \"...\""
    });
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

      {/* TABS */}
      <div className="flex gap-4 mb-6 border-b border-white/10">
        <button
          onClick={() => setActiveTab('persona')}
          className={`pb-2 px-2 font-bold ${activeTab === 'persona' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-white/40 hover:text-white'}`}
        >
          👤 Persona
        </button>
        <button
          onClick={() => setActiveTab('stories')}
          className={`pb-2 px-2 font-bold ${activeTab === 'stories' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-white/40 hover:text-white'}`}
        >
          📖 Stories & Pivots ({formData.storyMappings.length})
        </button>
      </div>

      {activeTab === 'persona' ? (
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block mb-1 font-semibold text-xs uppercase tracking-wider text-white/40">Target Persona</label>
            <input name="targetPersona" value={formData.targetPersona} onChange={handleChange} className="w-full p-2 rounded bg-black/10 border border-black/10 outline-none focus:border-blue-500/50 outline-none transition-colors border-none" placeholder="e.g. Smart Student-Athlete" />
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
      ) : (
        /* STORIES TAB */
        <div className="space-y-6">
          {!editingStory ? (
            <>
              <button onClick={createNewStory} className="w-full py-3 border-2 border-dashed border-white/20 rounded-lg text-white/40 hover:text-white hover:border-white/40 transition-all font-bold">
                + Create New Story Trigger
              </button>

              <div className="grid gap-4">
                {formData.storyMappings.map(story => (
                  <div key={story.id} className="bg-black/20 p-4 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-blue-400">{story.storyName}</h3>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingStory(story)} className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded">Edit</button>
                        <button onClick={() => deleteStory(story.id)} className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-1 rounded">Delete</button>
                      </div>
                    </div>
                    <div className="text-xs text-white/60 mb-2">
                      <span className="font-bold text-white/40">KEYWORDS:</span> {story.keywords.join(', ')}
                    </div>
                    <div className="text-xs text-white/40 line-clamp-2 italic bg-black/20 p-2 rounded">
                      {story.triggerPrompt}
                    </div>
                  </div>
                ))}

                {formData.storyMappings.length === 0 && (
                  <div className="text-center text-white/20 py-10 font-bold italic">
                    No stories added yet. Click above to add one!
                  </div>
                )}
              </div>
            </>
          ) : (
            /* STORY EDITOR FORM */
            <div className="bg-black/20 p-6 rounded-xl border border-white/10 space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-xl">📝 Editing: {editingStory.storyName}</h3>
                <button onClick={() => setEditingStory(null)} className="text-white/40 hover:text-white">Cancel</button>
              </div>

              <div>
                <label className="block mb-1 font-semibold text-xs uppercase tracking-wider text-white/40">Story Name (Internal ID)</label>
                <input
                  value={editingStory.storyName}
                  onChange={(e) => handleStoryChange('storyName', e.target.value)}
                  className="w-full p-2 rounded bg-black/30 border border-white/10 focus:border-blue-500/50 outline-none text-white"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-xs uppercase tracking-wider text-white/40">Keywords (Comma Separated)</label>
                <input
                  value={editingStory.keywords.join(', ')}
                  onChange={(e) => handleStoryChange('keywords', e.target.value)}
                  className="w-full p-2 rounded bg-black/30 border border-white/10 focus:border-blue-500/50 outline-none text-white"
                  placeholder="e.g. conflict, disagreement, fight"
                />
                <p className="text-[10px] text-white/40 mt-1">If the user says ANY of these words, this story will trigger.</p>
              </div>

              <div>
                <label className="block mb-1 font-semibold text-xs uppercase tracking-wider text-white/40">Strict System Prompt</label>
                <textarea
                  value={editingStory.triggerPrompt}
                  onChange={(e) => handleStoryChange('triggerPrompt', e.target.value)}
                  className="w-full p-4 rounded bg-black/30 border border-white/10 focus:border-blue-500/50 outline-none h-64 font-mono text-sm leading-relaxed tracking-wide text-white"
                />
                <p className="text-[10px] text-white/40 mt-1">This text is injected into the AI system prompt. Use "You MUST..." commands.</p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button onClick={() => setEditingStory(null)} className="px-4 py-2 text-white/60 hover:text-white">Cancel</button>
                <button onClick={saveExampleStory} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold shadow-lg shadow-blue-900/20">Save Story</button>
              </div>
            </div>
          )}

          {/* GLOBAL SAVE (Only visible when not editing) */}
          {!editingStory && (
            <button onClick={handleSave} className="w-full py-4 bg-green-600 hover:bg-green-500 rounded font-bold transition-colors shadow-lg shadow-green-900/20 text-lg">
              💾 Save All Changes
            </button>
          )}
        </div>
      )}
    </div>
  );
};
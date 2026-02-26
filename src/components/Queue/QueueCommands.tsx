import React, { useState, useEffect, useRef } from "react"
import { IoLogOutOutline } from "react-icons/io5"
import { Sparkles, MessageCircle, Zap, HelpCircle, FileText } from "lucide-react"

interface QueueCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void
  // New prop to handle the 5 toolbar commands
  onCommand: (type: 'assist' | 'reply' | 'answer' | 'ask' | 'recap', isCandidateMode: boolean) => void
}

const QueueCommands: React.FC<QueueCommandsProps> = ({
  onTooltipVisibilityChange,
  onCommand
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioResult, setAudioResult] = useState<string | null>(null)
  const chunks = useRef<Blob[]>([])

  useEffect(() => {
    let tooltipHeight = 0
    if (tooltipRef.current && isTooltipVisible) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10
    }
    onTooltipVisibilityChange(isTooltipVisible, tooltipHeight)
  }, [isTooltipVisible])

  const handleMouseEnter = () => {
    setIsTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setIsTooltipVisible(false)
  }

  const handleRecordClick = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        recorder.ondataavailable = (e) => chunks.current.push(e.data)
        recorder.onstop = async () => {
          const blob = new Blob(chunks.current, { type: chunks.current[0]?.type || 'audio/webm' })
          chunks.current = []
          const reader = new FileReader()
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1]
            try {
              // @ts-ignore
              const result = await window.electronAPI.analyzeAudioFromBase64(base64Data, blob.type)
              setAudioResult(result.text)
            } catch (err) {
              setAudioResult('Audio analysis failed.')
            }
          }
          reader.readAsDataURL(blob)
        }
        setMediaRecorder(recorder)
        recorder.start()
        setIsRecording(true)
      } catch (err) {
        setAudioResult('Could not start recording.')
      }
    } else {
      mediaRecorder?.stop()
      setIsRecording(false)
      setMediaRecorder(null)
    }
  }

  // --- NEW COMMAND HANDLER ---
  const handleAction = (type: 'assist' | 'reply' | 'answer' | 'ask' | 'recap') => {
    // The 'answer' button triggers the Digital Twin / Candidate mode
    const isCandidateMode = type === 'answer';
    onCommand(type, isCandidateMode);
  };

  return (
    <div className="w-fit">
      <div className="text-xs text-white/90 liquid-glass-bar py-1 px-3 flex items-center justify-center gap-3 draggable-area border border-white/10 shadow-2xl bg-black/40 backdrop-blur-xl rounded-full">

        {/* Voice Recording Button */}
        <div className="flex items-center">
          <button
            className={`transition-colors rounded-full p-1.5 flex items-center justify-center ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
            onClick={handleRecordClick}
            type="button"
          >
            <span className="text-[10px] mr-1">{isRecording ? "●" : "🎤"}</span>
          </button>
        </div>

        {/* Separator */}
        <div className="h-3 w-px bg-white/10" />

        {/* --- NEW 5-BUTTON TOOLBAR (Mini Version) --- */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleAction('assist')}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-500/20 text-blue-300 transition-colors"
          >
            <Sparkles size={11} />
          </button>

          <button
            onClick={() => handleAction('reply')}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-emerald-500/20 text-emerald-300 transition-colors"
          >
            <MessageCircle size={11} />
          </button>

          {/* Answer Button (Highlighted) */}
          <button
            onClick={() => handleAction('answer')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 font-bold transition-all border border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.2)]"
          >
            <Zap size={11} className="fill-current" /> <span className="text-[10px]">You</span>
          </button>

          <button
            onClick={() => handleAction('ask')}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-orange-500/20 text-orange-300 transition-colors"
          >
            <HelpCircle size={11} />
          </button>

          <button
            onClick={() => handleAction('recap')}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-gray-300 transition-colors"
          >
            <FileText size={11} />
          </button>
        </div>

        {/* Separator */}
        <div className="h-3 w-px bg-white/10" />

        {/* Help/Tooltip */}
        <div
          className="relative inline-block"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center cursor-help">
            <span className="text-[10px] text-white/50">?</span>
          </div>

          {/* Tooltip Content */}
          {isTooltipVisible && (
            <div
              ref={tooltipRef}
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 pointer-events-none"
            >
              <div className="p-3 text-[10px] bg-black/90 backdrop-blur-md rounded-lg border border-white/10 text-white/90 shadow-xl">
                <div className="space-y-2">
                  <p><strong className="text-purple-300">Answer (You):</strong> Switches to "Digital Twin" mode using your resume.</p>
                  <p><strong className="text-blue-300">Assist:</strong> Standard technical help.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sign Out */}
        <button
          className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10 p-1 rounded-full transition-colors"
          // @ts-ignore
          onClick={() => window.electronAPI.quitApp()}
        >
          <IoLogOutOutline className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Audio Result Toast */}
      {audioResult && (
        <div className="absolute top-full mt-2 left-0 right-0 p-2 bg-black/80 backdrop-blur border border-white/10 rounded-lg text-white text-[10px] text-center">
          {audioResult}
        </div>
      )}
    </div>
  )
}

export default QueueCommands
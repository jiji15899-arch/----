// 저장 위치: /src/components/conversion/ConversionEngine.tsx
// PHP→Astro 변환 엔진 UI 컴포넌트

import { useState, useRef } from 'react'
import { Upload, Link, FileCode, CheckCircle2, AlertTriangle, XCircle, BarChart3, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import { Spinner } from '@/components/ui/Spinner'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/utils'

interface FileResult {
  original: string
  output: string
  status: 'converted' | 'stub' | 'skipped' | 'error'
  message?: string
}

interface ConversionResult {
  totalFiles: number
  converted: number
  stubs: number
  warnings: number
  files: FileResult[]
}

interface ConversionEngineProps {
  siteId: string
  githubRepo: string
  onComplete?: (result: ConversionResult) => void
}

export function ConversionEngine({ siteId, githubRepo, onComplete }: ConversionEngineProps) {
  const { profile } = useAuthStore()
  const { addToast } = useToastStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [inputType, setInputType] = useState<'zip' | 'url'>('zip')
  const [wpUrl, setWpUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.zip')) {
      addToast({ type: 'error', message: 'ZIP 파일만 업로드 가능합니다' })
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      addToast({ type: 'error', message: '파일 크기는 50MB 이하여야 합니다' })
      return
    }
    setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.zip')) {
      setSelectedFile(file)
    }
  }

  const handleConvert = async () => {
    if (!profile) return
    if (inputType === 'zip' && !selectedFile) {
      addToast({ type: 'error', message: 'ZIP 파일을 선택해주세요' })
      return
    }
    if (inputType === 'url' && !wpUrl) {
      addToast({ type: 'error', message: 'WordPress URL을 입력해주세요' })
      return
    }

    setIsConverting(true)
    setProgress(0)
    setResult(null)

    // 진행률 시뮬레이션
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 90))
    }, 500)

    try {
      let zipBase64: string | undefined
      if (inputType === 'zip' && selectedFile) {
        const buffer = await selectedFile.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        bytes.forEach(b => { binary += String.fromCharCode(b) })
        zipBase64 = btoa(binary)
      }

      // Supabase Edge Function 호출
      const { data, error } = await supabase.functions.invoke('convert-wordpress', {
        body: {
          siteId,
          userId: profile.user_id,
          inputType,
          zipBase64,
          wpUrl: inputType === 'url' ? wpUrl : undefined,
          githubToken: profile.gh_token_encrypted,
          githubRepo,
        },
      })

      if (error) throw error

      clearInterval(progressInterval)
      setProgress(100)
      setResult(data.results)
      onComplete?.(data.results)
      addToast({ type: 'success', message: `변환 완료! ${data.results.converted}개 파일 변환됨` })
    } catch (err) {
      clearInterval(progressInterval)
      const msg = err instanceof Error ? err.message : '변환 중 오류가 발생했습니다'
      addToast({ type: 'error', message: msg })
    } finally {
      setIsConverting(false)
    }
  }

  const toggleFile = (filename: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }

  const statusIcon = (status: FileResult['status']) => {
    switch (status) {
      case 'converted': return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
      case 'stub': return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
      case 'error': return <XCircle className="w-4 h-4 text-red-500 shrink-0" />
      case 'skipped': return <div className="w-4 h-4 rounded-full bg-gray-300 shrink-0" />
    }
  }

  const statusLabel = (status: FileResult['status']) => {
    switch (status) {
      case 'converted': return '변환 완료'
      case 'stub': return '수동 검토 필요'
      case 'error': return '변환 실패'
      case 'skipped': return '건너뜀'
    }
  }

  return (
    <div className="space-y-6">
      {/* 입력 방식 선택 */}
      <div className="flex gap-2">
        <button
          onClick={() => setInputType('zip')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all',
            inputType === 'zip' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'
          )}
        >
          <Upload className="w-4 h-4" />
          ZIP 파일 업로드
        </button>
        <button
          onClick={() => setInputType('url')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all',
            inputType === 'url' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'
          )}
        >
          <Link className="w-4 h-4" />
          URL 입력
        </button>
      </div>

      {/* ZIP 업로드 */}
      {inputType === 'zip' && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            selectedFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          )}
        >
          <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileSelect} className="hidden" />
          {selectedFile ? (
            <div className="flex items-center justify-center gap-2">
              <FileCode className="w-6 h-6 text-green-500" />
              <span className="text-green-700 font-medium">{selectedFile.name}</span>
              <span className="text-green-600 text-sm">({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)</span>
            </div>
          ) : (
            <div>
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700 font-medium">WordPress ZIP 파일을 드래그하거나 클릭하여 업로드</p>
              <p className="text-gray-500 text-sm mt-1">테마, 플러그인 포함 가능 · 최대 50MB</p>
            </div>
          )}
        </div>
      )}

      {/* URL 입력 */}
      {inputType === 'url' && (
        <div>
          <input
            type="url"
            value={wpUrl}
            onChange={e => setWpUrl(e.target.value)}
            placeholder="https://your-wordpress-site.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">WordPress REST API가 활성화된 URL을 입력해주세요</p>
        </div>
      )}

      {/* 변환 버튼 */}
      <button
        onClick={handleConvert}
        disabled={isConverting || (!selectedFile && inputType === 'zip') || (!wpUrl && inputType === 'url')}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isConverting ? (
          <><Spinner size="sm" className="border-white" />변환 중...</>
        ) : (
          <><FileCode className="w-4 h-4" />PHP → Astro 변환 시작</>
        )}
      </button>

      {/* 진행률 바 */}
      {isConverting && (
        <div>
          <ProgressBar value={progress} />
          <p className="text-xs text-gray-500 text-center mt-1">PHP 파일을 분석하고 변환하는 중... ({Math.round(progress)}%)</p>
        </div>
      )}

      {/* 변환 결과 */}
      {result && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* 요약 */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">변환 결과 요약</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded-lg border border-gray-200 text-center">
                <p className="text-2xl font-bold text-gray-900">{result.totalFiles}</p>
                <p className="text-xs text-gray-500">총 파일</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                <p className="text-2xl font-bold text-green-700">{result.converted}</p>
                <p className="text-xs text-green-600">변환 완료</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
                <p className="text-2xl font-bold text-yellow-700">{result.stubs}</p>
                <p className="text-xs text-yellow-600">수동 검토</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
                <p className="text-2xl font-bold text-red-700">{result.warnings}</p>
                <p className="text-xs text-red-600">경고</p>
              </div>
            </div>
          </div>

          {/* 파일 목록 */}
          <div className="max-h-64 overflow-y-auto">
            {result.files.map((file, idx) => (
              <div key={idx} className="border-b border-gray-100 last:border-0">
                <button
                  onClick={() => toggleFile(file.original)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                >
                  {statusIcon(file.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{file.original}</p>
                    <p className="text-xs text-gray-500 truncate">→ {file.output}</p>
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full shrink-0',
                    file.status === 'converted' ? 'bg-green-100 text-green-700' :
                    file.status === 'stub' ? 'bg-yellow-100 text-yellow-700' :
                    file.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  )}>
                    {statusLabel(file.status)}
                  </span>
                  {file.message && (expandedFiles.has(file.original) ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />)}
                </button>
                {expandedFiles.has(file.original) && file.message && (
                  <div className="px-4 pb-3 pl-11">
                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">{file.message}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
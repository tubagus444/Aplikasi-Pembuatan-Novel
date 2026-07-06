import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorService } from '@/src/services/errorService';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // CATATAN: boundary ini SENGAJA hanya menangkap error RENDER React (lewat
  // getDerivedStateFromError/componentDidCatch). Dulu ia juga subscribe `window`
  // 'error'/'unhandledrejection' → SETIAP rejection (fetch AI gagal, worker, ekstensi
  // browser) berubah jadi layar crash seluruh app. Itu dicabut: rejection global cukup
  // dicatat (main.tsx → ErrorService) & disurfacekan via toast (useDbIssueListener),
  // tanpa membongkar UI. Crash penuh hanya untuk kegagalan render sejati.

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    ErrorService.log({
      message: error.message,
      type: 'error',
      source: 'React Error Boundary',
      stack: error.stack,
      metadata: { componentStack: errorInfo.componentStack }
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 mb-2">
              <AlertCircle size={40} />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Terjadi Kesalahan UI</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Aplikasi mengalami masalah saat merender tampilan. Error ini telah dicatat dalam log sistem.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-left">
              <p className="text-xs font-mono text-red-500 dark:text-red-400 break-all">
                {this.state.error?.message}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
              >
                <RefreshCw size={18} />
                Muat Ulang
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-lg font-medium transition-colors"
              >
                <Home size={18} />
                Halaman Utama
              </button>
            </div>
            
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              AetherScribe Safety Protocol Activated
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

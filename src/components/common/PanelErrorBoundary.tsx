import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorService } from '@/src/services/errorService';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Saat nilai ini berubah (mis. viewMode), error di-reset otomatis agar berpindah
   *  panel memulihkan boundary tanpa reload. */
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Boundary tingkat-PANEL (bukan root). Menahan crash render satu panel agar Sidebar,
 * Header, dan navigasi tetap hidup — pengguna bisa pindah panel alih-alih melihat layar
 * crash seluruh app. Root `ErrorBoundary` tetap sebagai jaring terakhir. BEDA dari root:
 * fallback ringkas & pulih otomatis saat `resetKey` (viewMode) berganti.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidUpdate(prev: Props) {
    // Pindah panel (resetKey berubah) → buang state error sehingga panel tujuan tampil.
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    ErrorService.log({
      message: error.message,
      type: 'error',
      source: 'Panel Error Boundary',
      stack: error.stack,
      metadata: { componentStack: errorInfo.componentStack },
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="mx-auto w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 mb-4">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Panel ini gagal dimuat
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            Terjadi kesalahan saat merender panel. Naskah &amp; data Anda tetap aman —
            coba lagi atau berpindah ke panel lain.
          </p>
          {this.state.error?.message && (
            <p className="mt-3 text-xs font-mono text-red-500 dark:text-red-400 break-all max-w-md">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            className="mt-5 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <RefreshCw size={16} />
            Coba Lagi
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

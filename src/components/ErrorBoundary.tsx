import { Component, type ReactNode } from 'react';

/**
 * ErrorBoundary — catches render/asset errors and shows a graceful fallback
 * instead of crashing the canvas (spec §5, §9).
 *
 * Used to wrap the hero GLB Suspense boundary. If a GLB fails to load
 * (missing file, corrupt Draco data, slow-connection timeout), we fall back
 * to the Icosahedron placeholder rather than nuking the entire canvas.
 *
 * Note: this only catches React render errors. WebGL context-loss events
 * fire outside React and need a separate listener (handled in Scene.tsx).
 */
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onCatch?: (error: Error, info: unknown) => void;
}
interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: unknown): void {
    // eslint-disable-next-line no-console
    console.warn('[ErrorBoundary] caught:', error.message, info);
    this.props.onCatch?.(error, info);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="absolute inset-0 flex items-center justify-center bg-redlife-bg/80 text-redlife-muted font-mono text-sm">
            <div className="text-center">
              <div className="text-redlife-accent text-glow">RENDER ERROR</div>
              <div className="mt-2 text-xs opacity-70">{this.state.error?.message}</div>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

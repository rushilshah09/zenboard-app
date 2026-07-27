'use client';
// Crash containment (PRD §9/§14): a view error degrades to a calm message +
// retry, never a blank page. Wrap each major view in <ViewBoundary>.
import { Component, type ReactNode } from 'react';
import { ErrorState } from './states';

export class ViewBoundary extends Component<
  { children: ReactNode; label?: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface to the console here; wire to real logging when we add it.
    console.error('ViewBoundary caught:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="This view hit a snag"
          hint={this.props.label ? `${this.props.label} couldn’t render.` : undefined}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

"use client";

import { Component, type ReactNode } from "react";

interface MapErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface MapErrorBoundaryState {
  hasError: boolean;
}

export default class MapErrorBoundary extends Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  state: MapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

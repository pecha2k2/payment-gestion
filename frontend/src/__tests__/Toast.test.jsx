import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../components/Toast';

function TestComponent() {
  const { addToast } = useToast();
  return (
    <button onClick={() => addToast('Hello World', 'success')}>
      Trigger Toast
    </button>
  );
}

describe('Toast Component', () => {
  it('renders children correctly', () => {
    render(
      <ToastProvider>
        <div>Child Content</div>
      </ToastProvider>
    );
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('shows toast message when triggered', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Trigger Toast');
    fireEvent.click(button);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });
});

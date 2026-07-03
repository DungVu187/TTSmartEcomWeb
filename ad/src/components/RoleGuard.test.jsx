import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoleGuard from './RoleGuard';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-hot-toast', () => ({
  default: {
    error: mockToastError,
  },
}));

const mockProfile = (user) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => user,
  });
};

describe('RoleGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when staff has the required function', async () => {
    mockProfile({ role: 'staff', functions: ['order_management'] });

    render(
      <RoleGuard requiredFunction="order_management">
        <div>Allowed content</div>
      </RoleGuard>
    );

    expect(await screen.findByText('Allowed content')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('redirects to product when staff lacks the required function', async () => {
    mockProfile({ role: 'staff', functions: ['iporder_management'] });

    render(
      <RoleGuard requiredFunction="order_management">
        <div>Denied content</div>
      </RoleGuard>
    );

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/product'));
    expect(screen.queryByText('Denied content')).not.toBeInTheDocument();
    expect(mockToastError).toHaveBeenCalled();
  });

  it('renders children for admin-only route when user is admin', async () => {
    mockProfile({ role: 'admin', functions: [] });

    render(
      <RoleGuard adminOnly>
        <div>Admin content</div>
      </RoleGuard>
    );

    expect(await screen.findByText('Admin content')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

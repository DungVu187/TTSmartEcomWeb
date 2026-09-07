import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  listTireOrders: vi.fn(), createTireOrder: vi.fn(), completeTireOrder: vi.fn(), revertTireOrder: vi.fn(),
}));
const navigateMock = vi.hoisted(() => vi.fn());
const canMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../../api/tireOrderAdministrationApi', () => apiMocks);
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));
vi.mock('../../context/permissioncontext', () => ({ usePermissions: () => ({ can: canMock }) }));
vi.mock('react-hot-toast', () => ({ default: { success: toastSuccessMock, error: toastErrorMock } }));

import TireOrders from './tireorders';

const processingOrder = {
  _id: 'order-1', orderName: 'Đơn đang xử lý', createdByName: 'Admin', totalVehicles: 1, totalTires: 2,
  totalExportPrice: 2500000, status: 'processing', createdAt: '2026-01-01T08:00:00.000Z',
  transactionDate: '2026-01-02T08:00:00.000Z', completedAt: null, version: 3,
};
const completedOrder = { ...processingOrder, _id: 'order-2', orderName: 'Đơn hoàn thành', status: 'completed', completedAt: '2026-01-03T08:00:00.000Z', version: 5 };

describe('TireOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canMock.mockReturnValue(true);
    apiMocks.listTireOrders.mockResolvedValue({ items: [processingOrder, completedOrder], pagination: { currentPage: 1, totalPages: 1, totalItems: 2 } });
    apiMocks.createTireOrder.mockResolvedValue({ order: { _id: 'new-order' } });
    apiMocks.completeTireOrder.mockResolvedValue({ order: { ...processingOrder, status: 'completed' } });
    apiMocks.revertTireOrder.mockResolvedValue({ order: { ...completedOrder, status: 'processing' } });
  });

  it('loads, renders totals and navigates to order detail', async () => {
    render(<TireOrders />);
    await screen.findByText('Đơn đang xử lý');
    expect(apiMocks.listTireOrders).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10 }));
    expect(screen.getAllByText('2 lốp')).toHaveLength(2);
    expect(screen.getAllByText(/2.500.000/)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0]);
    expect(navigateMock).toHaveBeenCalledWith('/tire-orders/order-1');
  });

  it('creates a trimmed order and opens its detail', async () => {
    render(<TireOrders />);
    await screen.findByText('Đơn đang xử lý');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo đơn mới' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tạo đơn lốp mới' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Tên đơn lốp/ }), { target: { value: '  Đơn mới  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo đơn' }));
    await waitFor(() => expect(apiMocks.createTireOrder).toHaveBeenCalledWith({ orderName: 'Đơn mới' }));
    expect(navigateMock).toHaveBeenCalledWith('/tire-orders/new-order');
  });

  it('requires confirmation before completing and reverting', async () => {
    render(<TireOrders />);
    await screen.findByText('Đơn đang xử lý');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hoàn thành đơn' }));
    expect(screen.getByText('Xác nhận hoàn thành đơn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(apiMocks.completeTireOrder).toHaveBeenCalledWith('order-1', { expectedVersion: 3 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hủy hoàn thành đơn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(apiMocks.revertTireOrder).toHaveBeenCalledWith('order-2', { expectedVersion: 5 }));
  });

  it('hides creation and disables status changes without permissions', async () => {
    canMock.mockReturnValue(false);
    render(<TireOrders />);
    await screen.findByText('Đơn đang xử lý');
    expect(screen.queryByRole('button', { name: 'Tạo đơn mới' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Hoàn thành đơn' })).toBeDisabled();
  });
});

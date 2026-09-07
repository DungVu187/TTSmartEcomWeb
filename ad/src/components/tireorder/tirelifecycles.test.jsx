import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.hoisted(() => vi.fn());
const detailMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../../api/tireOrderAdministrationApi', () => ({
  listTireLifecycles: listMock,
  getTireLifecycleDetail: detailMock,
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));
vi.mock('react-hot-toast', () => ({ default: { error: toastErrorMock } }));
vi.mock('./TireChassis', () => ({ default: ({ wheelCount, selectedSlotIds }) => <div data-testid="mini-chassis">{wheelCount}:{selectedSlotIds?.join(',')}</div> }));

import TireLifecycles from './tirelifecycles';

const ended = {
  _id: 'life-1', vehicleId: 'vehicle-1', licensePlate: '51A-123.45', vehicleName: 'Xe tải', wheelCount: 10,
  slotId: 'front_left', positionNumber: 1, productCode: 'MIC-OLD', serialNumber: 'SER-OLD-001', productName: 'Lốp Michelin cũ',
  startedAt: '2024-01-10T08:00:00.000Z', endedAt: '2025-02-12T09:30:00.000Z', status: 'ended',
  installOrderId: 'order-deleted', installOrderName: 'Đơn cũ', installOrderDeleted: true,
  replacementOrderId: 'order-next', replacementOrderName: 'Đơn mới', replacementOrderDeleted: false,
};
const active = {
  ...ended, _id: 'life-2', productCode: 'MIC-NEW', serialNumber: 'SER-NEW-002', productName: 'Lốp Michelin mới',
  startedAt: '2025-02-12T09:30:00.000Z', endedAt: null, status: 'active',
  installOrderId: 'order-next', installOrderName: 'Đơn mới', installOrderDeleted: false,
  replacementOrderId: null, replacementOrderName: '', replacementOrderDeleted: false,
};

describe('TireLifecycles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue({
      items: [ended, active],
      suggestions: { vehicles: ['51A-123.45'], tireCodes: ['MIC-OLD', 'MIC-NEW'] },
      pagination: { currentPage: 1, totalPages: 1, totalItems: 2, limit: 10 },
    });
    detailMock.mockResolvedValue({ selected: ended, chain: [ended, active] });
  });

  it('loads lifecycle rows and marks deleted order references without navigation', async () => {
    render(<TireLifecycles />);
    await screen.findByText('MIC-OLD');
    expect(listMock).toHaveBeenCalledWith({
      vehicle: '', tire: '', wheelCount: '', position: '', status: '', from: '', to: '', page: 1, limit: 10,
    });
    expect(screen.getByText('MIC-NEW')).toBeInTheDocument();
    expect(screen.getByText('SER-OLD-001')).toBeInTheDocument();
    expect(screen.getByText('SER-NEW-002')).toBeInTheDocument();
    expect(screen.getAllByText('Đơn đã xóa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đã xóa').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Đơn mới' })[0]);
    expect(navigateMock).toHaveBeenCalledWith('/tire-orders/order-next');
  });

  it('applies and resets all supported filters', async () => {
    render(<TireLifecycles />);
    await screen.findByText('MIC-OLD');
    fireEvent.change(screen.getByLabelText('Xe / Biển số'), { target: { value: '51A' } });
    fireEvent.change(screen.getByLabelText('Mã sản phẩm'), { target: { value: 'MIC' } });
    fireEvent.change(screen.getByLabelText('Loại xe'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Vị trí lốp'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'ended' } });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2024-01-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2025-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({
      vehicle: '51A', tire: 'MIC', wheelCount: '10', position: '1', status: 'ended',
      from: '2024-01-01', to: '2025-12-31', page: 1, limit: 10,
    })));
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ vehicle: '', tire: '', wheelCount: '', position: '', status: '' })));
  }, 15000);

  it('opens the complete chain drawer and keeps deleted links disabled', async () => {
    render(<TireLifecycles />);
    await screen.findByText('MIC-OLD');
    fireEvent.click(screen.getAllByRole('button', { name: 'Xem chi tiết vòng đời' })[0]);
    await screen.findByText('Chi tiết vòng đời lốp');
    expect(detailMock).toHaveBeenCalledWith('life-1');
    expect(screen.getByTestId('mini-chassis')).toHaveTextContent('10:front_left');
    expect(screen.getByText('Timeline vòng đời lốp')).toBeInTheDocument();
    expect(screen.getByText('Lần 1')).toBeInTheDocument();
    expect(screen.getByText('Lần 2')).toBeInTheDocument();
    expect(screen.getAllByText('SER-OLD-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SER-NEW-002').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Mở đơn xuất' })).not.toBeInTheDocument();
  });

  it('shows empty and error states', async () => {
    listMock.mockRejectedValueOnce(new Error('Không tải được vòng đời'));
    render(<TireLifecycles />);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Không tải được vòng đời'));
    expect(screen.getByText('Chưa có lịch sử lốp phù hợp.')).toBeInTheDocument();
  });
});

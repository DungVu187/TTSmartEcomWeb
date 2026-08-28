import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  addTireAssignments: vi.fn(), addTireOrderVehicle: vi.fn(), completeTireOrder: vi.fn(), createVehicle: vi.fn(),
  deleteTireAssignment: vi.fn(), deleteTireOrder: vi.fn(), deleteVehicle: vi.fn(), getActiveVehicleTires: vi.fn(),
  getTireOrder: vi.fn(), listTireProductOptions: vi.fn(), listVehicles: vi.fn(), moveTireAssignment: vi.fn(),
  removeTireOrderVehicle: vi.fn(), replaceTireAssignmentSlot: vi.fn(), revertTireOrder: vi.fn(),
  updateTireAssignment: vi.fn(), updateTireOrder: vi.fn(),
}));
const navigateMock = vi.hoisted(() => vi.fn());
const canMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../../api/tireOrderAdministrationApi', () => api);
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'order-1' }), useNavigate: () => navigateMock }));
vi.mock('../../context/permissioncontext', () => ({ usePermissions: () => ({ can: canMock }) }));
vi.mock('react-hot-toast', () => ({ default: { success: toastSuccessMock, error: toastErrorMock } }));
vi.mock('./TireChassis', () => ({
  default: ({ assignments = [], highlightedAssignmentId, selectable, selectedSlotIds = [], onSlotClick, onBackgroundClick }) => (
    <div
      data-testid={selectable ? 'assignment-chassis' : 'order-chassis'}
      data-highlighted={highlightedAssignmentId || ''}
      data-selected={selectedSlotIds.join(',')}
      onClick={onBackgroundClick}
    >
      {assignments.map((assignment) => (
        <button key={assignment._id} type="button" onClick={(event) => { event.stopPropagation(); onSlotClick?.(assignment.slotId, assignment); }}>
          slot-{assignment._id}
        </button>
      ))}
      {selectable && ['front_left', 'front_right', 'rear_left_forward_outer'].map((slotId) => (
        <button key={`choose-${slotId}`} type="button" onClick={(event) => { event.stopPropagation(); onSlotClick?.(slotId); }}>
          choose-{slotId}
        </button>
      ))}
      {!selectable && <button type="button" onClick={(event) => { event.stopPropagation(); onSlotClick?.('rear_left_forward_outer'); }}>empty-rear-left</button>}
    </div>
  ),
}));

import TireOrderDetail from './tireorderdetail';

const assignmentOne = {
  _id: 'assignment-1', productId: 'product-1', variantIndex: 0, variantId: 'variant-1', slotId: 'front_left',
  productCodeSnapshot: 'MIC-OLD', productNameSnapshot: 'Michelin cũ', brandSnapshot: 'Michelin',
  serialNumber: 'SER-OLD-001', exportPriceSnapshot: '1200000', performedAt: '2025-01-10T08:00:00.000Z', previousTireStoppedAt: null, note: '',
};
const assignmentTwo = { ...assignmentOne, _id: 'assignment-2', slotId: 'front_right', productCodeSnapshot: 'MIC-RIGHT', serialNumber: 'SER-OLD-002' };
const assignmentThree = { ...assignmentOne, _id: 'assignment-3', slotId: 'front_left', productCodeSnapshot: 'BRI-NEW', serialNumber: 'SER-OLD-003' };

const baseOrder = {
  _id: 'order-1', orderName: 'Đơn kiểm thử', note: 'Ghi chú', transactionDate: '2026-08-20T08:30:00.000Z',
  createdByName: 'Admin', status: 'processing', totalVehicles: 2, totalTires: 3, version: 7,
  vehicles: [
    { _id: 'entry-1', vehicleId: 'vehicle-1', licensePlateSnapshot: '51A-111.11', wheelCount: 10, assignments: [assignmentOne, assignmentTwo] },
    { _id: 'entry-2', vehicleId: 'vehicle-2', licensePlateSnapshot: '51B-222.22', wheelCount: 12, assignments: [assignmentThree] },
  ],
};

const productOption = {
  _id: 'product-1', code: 'MIC-NEW', name: 'Michelin mới',
  variants: [{ index: 0, _id: 'variant-1', frame: '215/60R17' }],
};

describe('TireOrderDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canMock.mockReturnValue(true);
    api.getTireOrder.mockResolvedValue({ order: structuredClone(baseOrder) });
    api.updateTireOrder.mockImplementation((_, body) => Promise.resolve({ order: { ...structuredClone(baseOrder), ...body, version: 8 } }));
    api.listVehicles.mockResolvedValue({ items: [
      { _id: 'vehicle-3', licensePlate: '51C-333.33', name: 'Xe mới', wheelCount: 10, version: 2 },
    ] });
    api.createVehicle.mockResolvedValue({ vehicle: { _id: 'vehicle-4', licensePlate: '51D-444.44', name: 'Xe vừa tạo', wheelCount: 12, version: 0 } });
    api.listTireProductOptions.mockResolvedValue({ items: [productOption] });
    api.getActiveVehicleTires.mockResolvedValue({ items: [{
      _id: 'old-life', slotId: 'front_right', positionNumber: 2, productCode: 'OLD-215', productName: 'Lốp cũ 215',
      startedAt: '2025-01-01T08:00:00.000Z', status: 'active',
    }] });
    api.replaceTireAssignmentSlot.mockResolvedValue({ order: structuredClone(baseOrder) });
    api.addTireOrderVehicle.mockResolvedValue({ order: structuredClone(baseOrder) });
    api.addTireAssignments.mockResolvedValue({ order: structuredClone(baseOrder) });
    api.updateTireAssignment.mockResolvedValue({ order: structuredClone(baseOrder) });
    api.moveTireAssignment.mockResolvedValue({ order: structuredClone(baseOrder) });
    api.deleteTireAssignment.mockResolvedValue({ order: structuredClone(baseOrder) });
    api.removeTireOrderVehicle.mockResolvedValue({ order: structuredClone(baseOrder) });
    api.completeTireOrder.mockResolvedValue({ order: { ...structuredClone(baseOrder), status: 'completed', version: 8 } });
    api.revertTireOrder.mockResolvedValue({ order: structuredClone(baseOrder) });
    api.deleteVehicle.mockResolvedValue({});
    api.deleteTireOrder.mockResolvedValue({ deleted: true });
  });

  it('loads the order, switches vehicles freely and saves the editable transaction date', async () => {
    render(<TireOrderDetail />);
    await screen.findByText('Sơ đồ lốp xe 51A-111.11');
    expect(api.getTireOrder).toHaveBeenCalledWith('order-1');
    fireEvent.click(screen.getByRole('button', { name: /51B-222.22/ }));
    expect(screen.getByText('Sơ đồ lốp xe 51B-222.22')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /51A-111.11/ }));
    expect(screen.getByText('Sơ đồ lốp xe 51A-111.11')).toBeInTheDocument();

    const dateField = screen.getByText('Ngày thực hiện').closest('.tire-order-info-field').querySelector('input');
    expect(dateField).not.toBeDisabled();
    fireEvent.change(dateField, { target: { value: '2026-08-25T10:15' } });
    fireEvent.blur(dateField);
    await waitFor(() => expect(api.updateTireOrder).toHaveBeenCalledWith('order-1', {
      transactionDate: '2026-08-25T10:15', expectedVersion: 7,
    }));
  });

  it('deselects only on a second click and allows switching or replacing another selected tire', async () => {
    render(<TireOrderDetail />);
    await screen.findByText('Sơ đồ lốp xe 51A-111.11');
    const chassis = screen.getByTestId('order-chassis');
    fireEvent.click(within(chassis).getByRole('button', { name: 'slot-assignment-1' }));
    expect(chassis).toHaveAttribute('data-highlighted', 'assignment-1');
    fireEvent.click(within(chassis).getByRole('button', { name: 'slot-assignment-1' }));
    expect(chassis).toHaveAttribute('data-highlighted', '');

    fireEvent.click(within(chassis).getByRole('button', { name: 'slot-assignment-1' }));
    fireEvent.click(within(chassis).getByRole('button', { name: 'slot-assignment-2' }));
    const replacementDialog = await screen.findByRole('dialog', { name: 'Xác nhận thay thế vị trí' });
    fireEvent.click(within(replacementDialog).getByRole('button', { name: 'Xác nhận thay thế' }));
    await waitFor(() => expect(api.replaceTireAssignmentSlot).toHaveBeenCalledWith('order-1', 'entry-1', 'assignment-1', {
      replacedAssignmentId: 'assignment-2', slotId: 'front_right', confirm: true, expectedVersion: 7,
    }));
  });

  it('changes selected slots up to quantity and defaults an editable old-tire stop time', async () => {
    render(<TireOrderDetail />);
    await screen.findByText('Sơ đồ lốp xe 51A-111.11');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm lốp' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm lốp' });
    await waitFor(() => expect(api.getActiveVehicleTires).toHaveBeenCalledWith('order-1', 'entry-1'));
    const chassis = within(dialog).getByTestId('assignment-chassis');
    expect(chassis.parentElement).toHaveClass('tire-assignment-chassis-wrap');
    fireEvent.click(within(chassis).getByRole('button', { name: 'choose-front_left' }));
    expect(chassis).toHaveAttribute('data-selected', 'front_left');
    fireEvent.click(within(chassis).getByRole('button', { name: 'choose-front_right' }));
    expect(chassis).toHaveAttribute('data-selected', 'front_right');

    expect(within(dialog).getByText(/Vị trí 2 đang có lốp cũ:/)).toHaveTextContent('OLD-215 — Lốp cũ 215 - Ngày thay trước:');
    const stoppedAt = dialog.querySelector('input[required][type="datetime-local"]');
    expect(stoppedAt).not.toBeNull();
    expect(stoppedAt.value).not.toBe('');
    fireEvent.change(stoppedAt, { target: { value: '2026-08-20T08:00' } });
    expect(stoppedAt).toHaveValue('2026-08-20T08:00');
  });

  it('uses concise confirmations and performs soft-delete requests for vehicles and orders', async () => {
    render(<TireOrderDetail />);
    await screen.findByText('Sơ đồ lốp xe 51A-111.11');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm xe' }));
    const vehicleDialog = await screen.findByRole('dialog', { name: 'Chọn xe' });
    fireEvent.click(within(vehicleDialog).getByRole('button', { name: 'Xóa xe 51C-333.33' }));
    const deleteVehicleDialog = await screen.findByRole('dialog', { name: 'Xác nhận xóa xe' });
    expect(within(deleteVehicleDialog).getByText(/Bạn có chắc chắn muốn xóa xe/)).toHaveTextContent('51C-333.33');
    fireEvent.click(within(deleteVehicleDialog).getByRole('button', { name: 'Xóa xe' }));
    await waitFor(() => expect(api.deleteVehicle).toHaveBeenCalledWith('vehicle-3', { expectedVersion: 2 }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Xác nhận xóa xe' })).not.toBeInTheDocument());
    fireEvent.click(within(vehicleDialog).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chọn xe' })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Xóa đơn' }));
    const deleteOrderDialog = await screen.findByRole('dialog', { name: 'Xác nhận xóa đơn' });
    expect(within(deleteOrderDialog).getByText('Bạn có chắc chắn muốn xóa đơn này không?')).toBeInTheDocument();
    fireEvent.click(within(deleteOrderDialog).getByRole('button', { name: 'Xóa đơn' }));
    await waitFor(() => expect(api.deleteTireOrder).toHaveBeenCalledWith('order-1', { expectedVersion: 7 }));
    expect(navigateMock).toHaveBeenCalledWith('/tire-orders');
  });

  it('creates or adds a vehicle and keeps create payload separate from adding to the order', async () => {
    render(<TireOrderDetail />);
    await screen.findByText('Sơ đồ lốp xe 51A-111.11');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm xe' }));
    let dialog = await screen.findByRole('dialog', { name: 'Chọn xe' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Biển số xe' }), { target: { value: ' 51D-444.44 ' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tên hoặc mô tả xe' }), { target: { value: ' Xe vừa tạo ' } });
    fireEvent.change(within(dialog).getByLabelText('Loại xe'), { target: { value: '12' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo xe' }));
    await waitFor(() => expect(api.createVehicle).toHaveBeenCalledWith({ licensePlate: '51D-444.44', name: 'Xe vừa tạo', wheelCount: 12 }));
    expect(toastSuccessMock).toHaveBeenCalledWith('Đã tạo xe.');

    fireEvent.click(within(dialog).getByRole('button', { name: /^51D-444.44/ }));
    await waitFor(() => expect(api.addTireOrderVehicle).toHaveBeenCalledWith('order-1', {
      vehicleId: 'vehicle-4', wheelCount: 12, expectedVersion: 7,
    }));
    expect(api.createVehicle).toHaveBeenCalledTimes(1);
  });

  it('adds, edits, moves and removes tire assignments through their visible controls', async () => {
    render(<TireOrderDetail />);
    await screen.findByText('Sơ đồ lốp xe 51A-111.11');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm lốp' }));
    let dialog = await screen.findByRole('dialog', { name: 'Thêm lốp' });
    const productInput = within(dialog).getByRole('combobox', { name: 'Sản phẩm lốp' });
    fireEvent.change(productInput, { target: { value: 'Michelin' } });
    const option = await screen.findByRole('option', { name: /MIC-NEW.*Michelin mới/ });
    fireEvent.click(option);
    fireEvent.click(within(dialog).getByRole('button', { name: 'choose-front_left' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Seri lốp' }), { target: { value: ' SER-NEW-001 ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(api.addTireAssignments).toHaveBeenCalledWith('order-1', 'entry-1', expect.objectContaining({
      productId: 'product-1', variantIndex: 0, variantId: 'variant-1', quantity: 1, slotIds: ['front_left'],
      serialNumbersBySlot: { front_left: 'SER-NEW-001' }, expectedVersion: 7,
    })));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Thêm lốp' })).not.toBeInTheDocument());

    const firstEditButton = screen.getAllByTestId('EditIcon')[0].closest('button');
    fireEvent.click(firstEditButton);
    dialog = await screen.findByRole('dialog', { name: 'Sửa lốp' });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Lưu' })).not.toBeDisabled());
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Ghi chú' }), { target: { value: 'Đã sửa lốp' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(api.updateTireAssignment).toHaveBeenCalledWith('order-1', 'entry-1', 'assignment-1', expect.objectContaining({
      productId: 'product-1', serialNumber: 'SER-OLD-001', note: 'Đã sửa lốp', expectedVersion: 7,
    })));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sửa lốp' })).not.toBeInTheDocument());

    const chassis = screen.getByTestId('order-chassis');
    fireEvent.click(within(chassis).getByRole('button', { name: 'slot-assignment-1', hidden: true }));
    fireEvent.click(within(chassis).getByRole('button', { name: 'choose-rear_left_forward_outer', hidden: true }));
    await waitFor(() => expect(api.moveTireAssignment).toHaveBeenCalledWith('order-1', 'entry-1', 'assignment-1', {
      slotId: 'rear_left_forward_outer', expectedVersion: 7,
    }));

    fireEvent.click(screen.getAllByTestId('DeleteIcon')[0].closest('button'));
    await waitFor(() => expect(api.deleteTireAssignment).toHaveBeenCalledWith('order-1', 'entry-1', 'assignment-1', { expectedVersion: 7 }));
  });

  it('requires one unique serial for every selected tire position', async () => {
    render(<TireOrderDetail />);
    await screen.findByText('Sơ đồ lốp xe 51A-111.11');
    expect(screen.getByText('SER-OLD-001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm lốp' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm lốp' });
    const productInput = within(dialog).getByRole('combobox', { name: 'Sản phẩm lốp' });
    fireEvent.change(productInput, { target: { value: 'Michelin' } });
    fireEvent.click(await screen.findByRole('option', { name: /MIC-NEW.*Michelin mới/ }));
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Số lượng' }), { target: { value: '2' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'choose-front_left' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'choose-front_right' }));
    const firstSerial = within(dialog).getByRole('textbox', { name: 'Seri lốp 1 — Vị trí 1' });
    const secondSerial = within(dialog).getByRole('textbox', { name: 'Seri lốp 2 — Vị trí 2' });
    fireEvent.change(firstSerial, { target: { value: 'DUP-001' } });
    fireEvent.change(secondSerial, { target: { value: 'dup-001' } });
    expect(within(dialog).getByRole('button', { name: 'Lưu' })).toBeDisabled();
    expect(within(dialog).getAllByText('Seri không được trùng trong cùng lần thêm.')).toHaveLength(2);
    fireEvent.change(secondSerial, { target: { value: 'DUP-002' } });
    expect(within(dialog).getByRole('button', { name: 'Lưu' })).not.toBeDisabled();
    const conflictMessage = 'Sản phẩm Michelin mới mã seri DUP-002 đã tồn tại ở đơn Đơn A.';
    api.addTireAssignments.mockRejectedValueOnce(Object.assign(new Error(conflictMessage), {
      code: 'TIRE_SERIAL_RESERVED', details: { normalizedSerial: 'DUP-002' },
    }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(await within(dialog).findByText(conflictMessage)).toBeInTheDocument();
    fireEvent.change(secondSerial, { target: { value: 'DUP-003' } });
    expect(within(dialog).queryByText(conflictMessage)).not.toBeInTheDocument();
  });

  it('confirms completion and vehicle removal before mutating the order', async () => {
    const view = render(<TireOrderDetail />);
    await screen.findByText('Sơ đồ lốp xe 51A-111.11');
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành đơn' }));
    let dialog = await screen.findByRole('dialog', { name: 'Xác nhận hoàn thành đơn' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hoàn thành đơn' }));
    await waitFor(() => expect(api.completeTireOrder).toHaveBeenCalledWith('order-1', { expectedVersion: 7 }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Xác nhận hoàn thành đơn' })).not.toBeInTheDocument());
    view.unmount();

    render(<TireOrderDetail />);
    await screen.findByText('Sơ đồ lốp xe 51A-111.11');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa xe khỏi đơn' }));
    dialog = await screen.findByRole('dialog', { name: 'Xác nhận xóa xe khỏi đơn' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa xe' }));
    await waitFor(() => expect(api.removeTireOrderVehicle).toHaveBeenCalledWith('order-1', 'entry-1', { expectedVersion: 7 }));
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TireChassis from './TireChassis';
import { TIRE_LAYOUTS } from './tireSlots';

const assignment = {
  _id: 'assignment-1',
  slotId: 'front_left',
  productCodeSnapshot: 'MIC-215',
  serialNumber: 'SER-001',
  performedAt: '2026-01-10T08:00:00.000Z',
};

describe('TireChassis', () => {
  it('numbers 10-wheel and 12-wheel layouts from top to bottom, left to right', () => {
    const { rerender } = render(<TireChassis wheelCount={10} />);
    let buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(10);
    expect(buttons.map((button) => button.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(buttons[0]).toHaveAccessibleName(/Vị trí 1/);
    expect(buttons[1]).toHaveAccessibleName(/Vị trí 2/);

    rerender(<TireChassis wheelCount={12} />);
    buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(12);
    expect(buttons.map((button) => button.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  });

  it('renders the assigned tire, replacement date and selected state', () => {
    render(<TireChassis assignments={[assignment]} selectedSlotIds={['front_left']} />);
    expect(screen.getByText('MIC-215')).toBeInTheDocument();
    expect(screen.getByText('Seri: SER-001')).toBeInTheDocument();
    expect(screen.getByText(/Thay:/)).toBeInTheDocument();
    expect(screen.getByText(/Đã dùng:/)).toBeInTheDocument();
    const labelLines = ['MIC-215', 'Seri: SER-001', screen.getByText(/Thay:/).textContent, screen.getByText(/Đã dùng:/).textContent]
      .map((text) => Number(screen.getByText(text).getAttribute('y')));
    expect(labelLines).toEqual([59.5, 70.5, 81.5, 92.5]);
    expect((labelLines[0] + labelLines[3]) / 2).toBe(76);
    expect(screen.getByRole('button', { name: /^Vị trí 1,/ })).toHaveClass('assigned', 'selected');
  });

  it('spaces the six label rows evenly on the 12-wheel layout', () => {
    const assignments = TIRE_LAYOUTS[12].map((slotId, index) => ({
      ...assignment,
      _id: `assignment-${index + 1}`,
      slotId,
      productCodeSnapshot: `CODE-${index + 1}`,
    }));
    const { container } = render(<TireChassis assignments={assignments} wheelCount={12} />);
    const codeRows = [...new Set(assignments.map((item) => Number(screen.getByText(item.productCodeSnapshot).getAttribute('y'))))].sort((left, right) => left - right);
    expect(codeRows).toEqual([31.5, 83.5, 135.5, 187.5, 239.5, 291.5]);
    expect(codeRows.slice(1).map((value, index) => value - codeRows[index])).toEqual([52, 52, 52, 52, 52]);
    expect([...container.querySelectorAll('.tire-product-leader')].map((path) => path.getAttribute('d'))).toEqual([
      'M 138 48 H 108', 'M 302 48 H 332', 'M 138 100 H 108', 'M 302 100 H 332',
      'M 115 196 L 103 204', 'M 149 173 L 124 152 H 108', 'M 291 173 L 316 152 H 332', 'M 325 196 L 337 204',
      'M 115 268 L 103 256', 'M 149 290 L 124 308 H 108', 'M 291 290 L 316 308 H 332', 'M 325 268 L 337 256',
    ]);
  });

  it('blocks occupied slots unless replacement clicks are explicitly allowed', () => {
    const onSlotClick = vi.fn();
    const { rerender } = render(
      <TireChassis assignments={[assignment]} selectable onSlotClick={onSlotClick} />,
    );
    const occupied = screen.getByRole('button', { name: /^Vị trí 1,/ });
    expect(occupied).toBeDisabled();
    fireEvent.click(occupied);
    expect(onSlotClick).not.toHaveBeenCalled();

    rerender(<TireChassis assignments={[assignment]} selectable allowOccupiedClick onSlotClick={onSlotClick} />);
    fireEvent.click(screen.getByRole('button', { name: /^Vị trí 1,/ }));
    expect(onSlotClick).toHaveBeenCalledWith('front_left', assignment);
  });

  it('separates slot clicks from chassis background clicks', () => {
    const onSlotClick = vi.fn();
    const onBackgroundClick = vi.fn();
    render(<TireChassis onSlotClick={onSlotClick} onBackgroundClick={onBackgroundClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Vị trí 2/ }));
    expect(onSlotClick).toHaveBeenCalledWith('front_right', undefined);
    expect(onBackgroundClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Khung xe 10 bánh'));
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
  });
});

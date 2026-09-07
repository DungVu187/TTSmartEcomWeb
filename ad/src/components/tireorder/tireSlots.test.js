import { describe, expect, it } from 'vitest';
import { getTireSlots, TIRE_LAYOUTS } from './tireSlots';

describe('admin tire slot layouts', () => {
  it('keeps row-major numbering for the 10-wheel chassis', () => {
    expect(getTireSlots(10)).toEqual([
      'front_left', 'front_right',
      'rear_left_forward_outer', 'rear_left_forward_inner', 'rear_right_forward_inner', 'rear_right_forward_outer',
      'rear_left_aft_outer', 'rear_left_aft_inner', 'rear_right_aft_inner', 'rear_right_aft_outer',
    ]);
  });

  it('adds the second front row in left-to-right order for 12 wheels', () => {
    expect(getTireSlots(12)).toEqual([
      'front_left', 'front_right', 'front_second_left', 'front_second_right',
      'rear_left_forward_outer', 'rear_left_forward_inner', 'rear_right_forward_inner', 'rear_right_forward_outer',
      'rear_left_aft_outer', 'rear_left_aft_inner', 'rear_right_aft_inner', 'rear_right_aft_outer',
    ]);
    expect(new Set(TIRE_LAYOUTS[12]).size).toBe(12);
  });

  it('falls back legacy and unsupported values to the 10-wheel layout', () => {
    expect(getTireSlots()).toBe(TIRE_LAYOUTS[10]);
    expect(getTireSlots(8)).toBe(TIRE_LAYOUTS[10]);
    expect(getTireSlots('12')).toBe(TIRE_LAYOUTS[12]);
  });
});

const {
  TIRE_LAYOUTS,
  TIRE_SLOT_IDS,
  TIRE_PRODUCT_TYPE,
  normalizeWheelCount,
  slotsForWheelCount,
} = require('../config/tireSlots');

describe('tire order slot configuration', () => {
  test('contains stable 10-wheel and 12-wheel layouts', () => {
    expect(TIRE_LAYOUTS[10]).toHaveLength(10);
    expect(TIRE_LAYOUTS[12]).toHaveLength(12);
    expect(TIRE_SLOT_IDS).toHaveLength(12);
    expect(new Set(TIRE_SLOT_IDS).size).toBe(12);
    expect(TIRE_LAYOUTS[12]).toEqual(expect.arrayContaining([
      'front_second_left',
      'front_second_right',
      'rear_right_aft_outer',
    ]));
    expect(TIRE_LAYOUTS[10]).not.toContain('front_second_left');
  });

  test('defaults legacy values to 10 wheels and resolves supported layouts', () => {
    expect(normalizeWheelCount(undefined)).toBe(10);
    expect(normalizeWheelCount('12')).toBe(12);
    expect(normalizeWheelCount(8)).toBeNull();
    expect(slotsForWheelCount(undefined)).toBe(TIRE_LAYOUTS[10]);
    expect(slotsForWheelCount(12)).toBe(TIRE_LAYOUTS[12]);
  });

  test('uses the exact tire product classification', () => {
    expect(TIRE_PRODUCT_TYPE).toBe('Lốp xe');
  });
});

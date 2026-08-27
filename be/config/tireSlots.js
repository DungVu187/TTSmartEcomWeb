const REAR_TIRE_SLOT_IDS = Object.freeze([
  'rear_left_forward_outer', 'rear_left_forward_inner',
  'rear_right_forward_inner', 'rear_right_forward_outer',
  'rear_left_aft_outer', 'rear_left_aft_inner',
  'rear_right_aft_inner', 'rear_right_aft_outer',
]);

const TIRE_LAYOUTS = Object.freeze({
  10: Object.freeze(['front_left', 'front_right', ...REAR_TIRE_SLOT_IDS]),
  12: Object.freeze(['front_left', 'front_right', 'front_second_left', 'front_second_right', ...REAR_TIRE_SLOT_IDS]),
});

const TIRE_SLOT_IDS = Object.freeze([...new Set(Object.values(TIRE_LAYOUTS).flat())]);
const TIRE_WHEEL_COUNTS = Object.freeze([10, 12]);
const TIRE_PRODUCT_TYPE = 'Lốp xe';

const normalizeWheelCount = (value) => {
  const result = Number(value ?? 10);
  return TIRE_WHEEL_COUNTS.includes(result) ? result : null;
};

const slotsForWheelCount = (value) => TIRE_LAYOUTS[normalizeWheelCount(value) || 10];

module.exports = { TIRE_LAYOUTS, TIRE_SLOT_IDS, TIRE_WHEEL_COUNTS, TIRE_PRODUCT_TYPE, normalizeWheelCount, slotsForWheelCount };

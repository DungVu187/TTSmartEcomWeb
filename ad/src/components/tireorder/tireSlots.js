const REAR_TIRE_SLOTS = [
  'rear_left_forward_outer', 'rear_left_forward_inner', 'rear_left_aft_outer', 'rear_left_aft_inner',
  'rear_right_forward_inner', 'rear_right_forward_outer', 'rear_right_aft_inner', 'rear_right_aft_outer',
];

export const TIRE_LAYOUTS = {
  10: ['front_left', 'front_right', ...REAR_TIRE_SLOTS],
  12: ['front_left', 'front_right', 'front_second_left', 'front_second_right', ...REAR_TIRE_SLOTS],
};

export const getTireSlots = (wheelCount = 10) => TIRE_LAYOUTS[Number(wheelCount)] || TIRE_LAYOUTS[10];
export const TIRE_SLOTS = TIRE_LAYOUTS[10];

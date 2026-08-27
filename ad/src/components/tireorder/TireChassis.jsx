import { Box, Tooltip } from '@mui/material';
import { getTireSlots } from './tireSlots';
import '../style/tireorder.css';
import '../style/tireorder-overrides.css';

const REAR_LABEL_LAYOUT = {
  rear_left_forward_outer: { path: 'M 115 196 H 103', x: 63, y: 196 },
  rear_left_forward_inner: { path: 'M 149 173 L 124 140 H 108', x: 68, y: 140 },
  rear_left_aft_outer: { path: 'M 115 251 H 103', x: 63, y: 251 },
  rear_left_aft_inner: { path: 'M 149 273 L 124 306 H 108', x: 68, y: 306 },
  rear_right_forward_inner: { path: 'M 291 173 L 316 140 H 332', x: 372, y: 140 },
  rear_right_forward_outer: { path: 'M 325 196 H 337', x: 377, y: 196 },
  rear_right_aft_inner: { path: 'M 291 273 L 316 306 H 332', x: 372, y: 306 },
  rear_right_aft_outer: { path: 'M 325 251 H 337', x: 377, y: 251 },
};

const LABEL_LAYOUTS = {
  10: {
    front_left: { path: 'M 138 76 H 108', x: 68, y: 76 },
    front_right: { path: 'M 302 76 H 332', x: 372, y: 76 },
    ...REAR_LABEL_LAYOUT,
  },
  12: {
    front_left: { path: 'M 138 53 H 108', x: 68, y: 53 },
    front_right: { path: 'M 302 53 H 332', x: 372, y: 53 },
    front_second_left: { path: 'M 138 113 H 108', x: 68, y: 113 },
    front_second_right: { path: 'M 302 113 H 332', x: 372, y: 113 },
    ...REAR_LABEL_LAYOUT,
  },
};

const STATIC_CONNECTIONS = {
  10: 'M 158 76 H 169 M 271 76 H 282 M 135 196 H 169 M 271 196 H 305 M 135 251 H 169 M 271 251 H 305',
  12: 'M 158 53 H 169 M 271 53 H 282 M 158 113 H 169 M 271 113 H 282 M 135 196 H 169 M 271 196 H 305 M 135 251 H 169 M 271 251 H 305',
};

const formatReplacementDate = (value) => {
  if (!value) return '—';
  const replacementDate = new Date(value);
  if (Number.isNaN(replacementDate.getTime())) return '—';
  return replacementDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const addCalendarMonths = (date, months) => {
  const targetMonth = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(date.getUTCDate(), lastDay)));
};

const formatUsageDuration = (value) => {
  if (!value) return '—';
  const replacementDate = new Date(value);
  if (Number.isNaN(replacementDate.getTime())) return '—';
  const start = new Date(Date.UTC(replacementDate.getFullYear(), replacementDate.getMonth(), replacementDate.getDate()));
  const now = new Date();
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (start > end) return 'Chưa dùng';
  if (start.getTime() === end.getTime()) return 'Hôm nay';
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let cursor = addCalendarMonths(start, years * 12);
  if (cursor > end) { years -= 1; cursor = addCalendarMonths(start, years * 12); }
  let months = ((end.getUTCFullYear() - cursor.getUTCFullYear()) * 12) + end.getUTCMonth() - cursor.getUTCMonth();
  let monthCursor = addCalendarMonths(cursor, months);
  if (monthCursor > end) { months -= 1; monthCursor = addCalendarMonths(cursor, months); }
  const days = Math.floor((end.getTime() - monthCursor.getTime()) / 86400000);
  return [years && `${years}n`, months && `${months}th`, days && `${days}ng`].filter(Boolean).join(' ');
};

const TireChassis = ({ assignments = [], wheelCount = 10, selectedSlotIds = [], highlightedAssignmentId, selectable = false, allowOccupiedClick = false, onSlotClick, onBackgroundClick }) => {
  const normalizedWheelCount = Number(wheelCount) === 12 ? 12 : 10;
  const tireSlots = getTireSlots(normalizedWheelCount);
  const labelLayout = LABEL_LAYOUTS[normalizedWheelCount];
  const selected = new Set(selectedSlotIds);
  const assignmentsBySlot = new Map(assignments.map((assignment) => [assignment.slotId, assignment]));
  const labelledAssignments = tireSlots.map((slotId) => ({ slotId, assignment: assignmentsBySlot.get(slotId) })).filter(({ assignment }) => assignment?.productCodeSnapshot);

  return <Box className={`tire-chassis tire-chassis-${normalizedWheelCount}`} aria-label={`Khung xe ${normalizedWheelCount} bánh`} onClick={() => onBackgroundClick?.()}>
    <svg className="tire-link-layer" viewBox="0 0 440 350" aria-hidden="true">
      <path className="tire-static-link" d={STATIC_CONNECTIONS[normalizedWheelCount]} />
      {labelledAssignments.map(({ slotId, assignment }) => {
        const label = labelLayout[slotId];
        const replacementDate = formatReplacementDate(assignment.performedAt);
        const usageDuration = formatUsageDuration(assignment.performedAt);
        return <g key={slotId}>
          <path className="tire-product-leader" d={label.path} />
          <text className="tire-product-code" x={label.x} y={label.y - 11} textAnchor="middle">{assignment.productCodeSnapshot}</text>
          <text className="tire-product-meta" x={label.x} y={label.y} textAnchor="middle">Thay: {replacementDate}</text>
          <text className="tire-product-meta" x={label.x} y={label.y + 11} textAnchor="middle">Đã dùng: {usageDuration}</text>
        </g>;
      })}
    </svg>
    <Box className="tire-chassis-body" aria-hidden="true" />
    {tireSlots.map((slotId) => {
      const assignment = assignmentsBySlot.get(slotId);
      const occupied = Boolean(assignment);
      const active = selected.has(slotId) || Boolean(highlightedAssignmentId && highlightedAssignmentId === assignment?._id);
      return <Tooltip key={slotId} title={assignment?.productCodeSnapshot || (occupied ? 'Đã gán lốp' : 'Vị trí trống')}>
        <span className={`tire-slot-wrap tire-slot-${slotId}`}>
          <button type="button" className={`tire-slot ${occupied ? 'assigned' : ''} ${active ? 'selected' : ''}`} disabled={selectable && occupied && !allowOccupiedClick} onClick={(event) => { event.stopPropagation(); onSlotClick?.(slotId, assignment); }} aria-label={occupied ? 'Vị trí đã gán lốp' : 'Vị trí lốp trống'} />
        </span>
      </Tooltip>;
    })}
  </Box>;
};

export default TireChassis;

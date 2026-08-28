import { useEffect, useState } from 'react';
import { Autocomplete, Box, Button, Chip, CircularProgress, Drawer, IconButton, InputAdornment, Pagination, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTireLifecycleDetail, listTireLifecycles } from '../../api/tireOrderAdministrationApi';
import TireChassis from './TireChassis';
import '../style/tirelifecycles.css';

const EMPTY_FILTERS = { vehicle: '', tire: '', wheelCount: '', position: '', status: '', from: '', to: '' };
const PAGE_SIZE = 10;
const formatDate = (value) => value ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const formatDateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const addCalendarMonths = (date, months) => {
  const targetMonth = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
};

const formatDuration = (startedAt, endedAt) => {
  const startValue = new Date(startedAt);
  const endValue = endedAt ? new Date(endedAt) : new Date();
  if (Number.isNaN(startValue.getTime()) || Number.isNaN(endValue.getTime()) || endValue < startValue) return '—';
  const start = new Date(Date.UTC(startValue.getFullYear(), startValue.getMonth(), startValue.getDate()));
  const end = new Date(Date.UTC(endValue.getFullYear(), endValue.getMonth(), endValue.getDate()));
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let cursor = addCalendarMonths(start, years * 12);
  if (cursor > end) { years -= 1; cursor = addCalendarMonths(start, years * 12); }
  let months = ((end.getUTCFullYear() - cursor.getUTCFullYear()) * 12) + end.getUTCMonth() - cursor.getUTCMonth();
  let monthCursor = addCalendarMonths(cursor, months);
  if (monthCursor > end) { months -= 1; monthCursor = addCalendarMonths(cursor, months); }
  const days = Math.floor((end.getTime() - monthCursor.getTime()) / 86400000);
  if (!years && !months && !days) return 'Hôm nay';
  return [years && `${years} năm`, months && `${months} tháng`, days && `${days} ngày`].filter(Boolean).join(' ');
};

const StatusChip = ({ status }) => <Chip size="small" className={`tire-lifecycle-status tire-lifecycle-status-${status}`} label={status === 'active' ? 'Đang sử dụng' : 'Đã kết thúc'} />;
const OrderReference = ({ id, name, deleted, navigate, endIcon = false }) => {
  if (!id) return <strong>—</strong>;
  if (deleted) return <Chip size="small" color="error" variant="outlined" label="Đã xóa" />;
  return <Button size="small" endIcon={endIcon ? <OpenInNewIcon /> : undefined} onClick={() => navigate(`/tire-orders/${id}`)}>{name || 'Mở đơn'}</Button>;
};

const TireLifecycleTimelineItem = ({ item, index, navigate }) => <Box className="tire-lifecycle-timeline-item">
  <Box className="tire-lifecycle-timeline-date"><Typography>{formatDate(item.startedAt)}</Typography><Typography>đến</Typography><Typography>{item.endedAt ? formatDate(item.endedAt) : 'hiện tại'}</Typography></Box>
  <Box className="tire-lifecycle-timeline-rail"><i className={item.status} /></Box>
  <Paper variant="outlined" className="tire-lifecycle-timeline-card">
    <Box className="tire-lifecycle-timeline-card-head"><Chip size="small" label={`Lần ${index + 1}`} /><Box><Typography>Mã lốp</Typography><strong>{item.productCode || '—'}</strong></Box><Box><Typography>Seri</Typography><strong>{item.serialNumber || '—'}</strong></Box><Box><Typography>Tên lốp</Typography><strong>{item.productName || '—'}</strong></Box><Stack direction="row" spacing={0.75} alignItems="center"><StatusChip status={item.status} />{item.installOrderDeleted && <Chip size="small" color="error" label="Đơn đã xóa" />}</Stack></Box>
    <Box className="tire-lifecycle-timeline-metrics"><Box><Typography>Thời gian sử dụng</Typography><strong>{formatDuration(item.startedAt, item.endedAt)}</strong></Box><Box><Typography>Đơn xuất</Typography><OrderReference id={item.installOrderId} name={item.installOrderName} deleted={item.installOrderDeleted} navigate={navigate} /></Box><Box><Typography>Đơn xuất kế tiếp</Typography><OrderReference id={item.replacementOrderId} name={item.replacementOrderName} deleted={item.replacementOrderDeleted} navigate={navigate} /></Box></Box>
  </Paper>
</Box>;

const TireLifecycles = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], suggestions: { vehicles: [], tireCodes: [] }, pagination: {} });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listTireLifecycles({ ...appliedFilters, page, limit: PAGE_SIZE })
      .then((result) => { if (active) setData(result); })
      .catch((error) => { if (active) toast.error(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [appliedFilters, page]);

  const search = () => { setPage(1); setAppliedFilters({ ...filters }); setDetail(null); };
  const reset = () => { setFilters(EMPTY_FILTERS); setAppliedFilters(EMPTY_FILTERS); setPage(1); setDetail(null); };
  const viewDetail = async (id) => {
    setDetailLoading(true);
    try {
      setDetail(await getTireLifecycleDetail(id));
    } catch (error) { toast.error(error.message); } finally { setDetailLoading(false); }
  };

  const pagination = data.pagination || {};
  const positionCount = Number(filters.wheelCount) === 10 ? 10 : 12;
  const currentLifecycle = detail?.chain.at(-1);
  const firstItem = pagination.totalItems ? ((pagination.currentPage - 1) * PAGE_SIZE) + 1 : 0;
  const lastItem = Math.min((pagination.currentPage || 1) * PAGE_SIZE, pagination.totalItems || 0);

  return <Box className="tire-lifecycle-page">
    <Paper className="tire-lifecycle-filter-card">
      <Typography variant="h5" className="tire-lifecycle-page-title">Quản lý lịch sử lốp</Typography>
      <Box className="tire-lifecycle-filter-grid">
        <Autocomplete freeSolo autoHighlight options={data.suggestions?.vehicles || []} inputValue={filters.vehicle} onInputChange={(_, value) => setFilters({ ...filters, vehicle: value })} renderInput={(params) => <TextField {...params} label="Xe / Biển số" placeholder="Nhập biển số xe..." InputProps={{ ...params.InputProps, startAdornment: <><InputAdornment position="start"><DirectionsCarIcon /></InputAdornment>{params.InputProps.startAdornment}</> }} />} />
        <Autocomplete freeSolo autoHighlight options={data.suggestions?.tireCodes || []} inputValue={filters.tire} onInputChange={(_, value) => setFilters({ ...filters, tire: value })} renderInput={(params) => <TextField {...params} label="Mã lốp" placeholder="Nhập mã lốp..." InputProps={{ ...params.InputProps, startAdornment: <><InputAdornment position="start"><LocalOfferOutlinedIcon /></InputAdornment>{params.InputProps.startAdornment}</> }} />} />
        <TextField select SelectProps={{ native: true }} InputLabelProps={{ shrink: true }} label="Loại xe" value={filters.wheelCount} onChange={(event) => { const wheelCount = event.target.value; setFilters({ ...filters, wheelCount, position: Number(filters.position) > Number(wheelCount || 12) ? '' : filters.position }); }}><option value="">Tất cả</option><option value="10">Xe 10 bánh</option><option value="12">Xe 12 bánh</option></TextField>
        <TextField select SelectProps={{ native: true }} InputLabelProps={{ shrink: true }} label="Vị trí lốp" value={filters.position} onChange={(event) => setFilters({ ...filters, position: event.target.value })}><option value="">Tất cả vị trí</option>{Array.from({ length: positionCount }, (_, index) => <option key={index + 1} value={index + 1}>Vị trí {index + 1}</option>)}</TextField>
        <TextField select SelectProps={{ native: true }} InputLabelProps={{ shrink: true }} label="Trạng thái" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Tất cả trạng thái</option><option value="active">Đang sử dụng</option><option value="ended">Đã kết thúc</option></TextField>
        <Box className="tire-lifecycle-date-range"><TextField label="Từ ngày" type="date" InputLabelProps={{ shrink: true }} value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /><TextField label="Đến ngày" type="date" InputLabelProps={{ shrink: true }} value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></Box>
        <Stack className="tire-lifecycle-filter-actions" direction="row" spacing={1}><Button variant="contained" startIcon={<SearchIcon />} onClick={search}>Tìm kiếm</Button><Button variant="outlined" startIcon={<RestartAltIcon />} onClick={reset}>Đặt lại</Button></Stack>
      </Box>
    </Paper>

    <Paper className="tire-lifecycle-list-card">
      <Box className="tire-lifecycle-list-head"><Typography variant="h6">Danh sách lịch sử lốp</Typography></Box>
      {loading ? <Box className="tire-lifecycle-loading"><CircularProgress /></Box> : <TableContainer className="tire-lifecycle-table-wrap"><Table className="tire-lifecycle-table" size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>Biển số xe</TableCell><TableCell>Loại xe</TableCell><TableCell>Vị trí lốp</TableCell><TableCell>Mã lốp</TableCell><TableCell>Seri</TableCell><TableCell>Tên lốp</TableCell><TableCell>Ngày bắt đầu</TableCell><TableCell>Thời điểm ngưng hoạt động</TableCell><TableCell>Thời gian sử dụng</TableCell><TableCell>Trạng thái</TableCell><TableCell>Đơn xuất</TableCell><TableCell>Đơn xuất kế tiếp</TableCell><TableCell align="center">Thao tác</TableCell></TableRow></TableHead><TableBody>{data.items.map((item, index) => <TableRow key={item._id} hover><TableCell>{firstItem + index}</TableCell><TableCell>{item.licensePlate}</TableCell><TableCell>{item.wheelCount} bánh</TableCell><TableCell>Vị trí {item.positionNumber}</TableCell><TableCell>{item.productCode || '—'}</TableCell><TableCell>{item.serialNumber || '—'}</TableCell><TableCell>{item.productName}</TableCell><TableCell>{formatDate(item.startedAt)}</TableCell><TableCell>{formatDateTime(item.endedAt)}</TableCell><TableCell>{formatDuration(item.startedAt, item.endedAt)}</TableCell><TableCell><Stack spacing={0.5} alignItems="flex-start"><StatusChip status={item.status} />{item.installOrderDeleted && <Chip size="small" color="error" label="Đơn đã xóa" />}</Stack></TableCell><TableCell><OrderReference id={item.installOrderId} name={item.installOrderName} deleted={item.installOrderDeleted} navigate={navigate} /></TableCell><TableCell><OrderReference id={item.replacementOrderId} name={item.replacementOrderName} deleted={item.replacementOrderDeleted} navigate={navigate} /></TableCell><TableCell align="center"><IconButton color="primary" aria-label="Xem chi tiết vòng đời" disabled={detailLoading} onClick={() => viewDetail(item._id)}><VisibilityOutlinedIcon fontSize="small" /></IconButton></TableCell></TableRow>)}</TableBody></Table></TableContainer>}
      {!loading && !data.items.length && <Typography className="tire-lifecycle-empty">Chưa có lịch sử lốp phù hợp.</Typography>}
      <Box className="tire-lifecycle-pagination"><Typography>Hiển thị {firstItem} đến {lastItem} của {pagination.totalItems || 0} kết quả</Typography><Pagination page={page} count={pagination.totalPages || 1} onChange={(_, value) => setPage(value)} color="primary" /></Box>
    </Paper>

    <Drawer anchor="right" open={Boolean(detail)} onClose={() => setDetail(null)} className="tire-lifecycle-detail-drawer">
      {detail && <><Box className="tire-lifecycle-drawer-head"><Typography variant="h6">Chi tiết vòng đời lốp</Typography><Stack direction="row" spacing={1}>{detail.selected.installOrderDeleted ? <Chip color="error" variant="outlined" label="Đơn đã xóa" /> : <Button variant="outlined" startIcon={<OpenInNewIcon />} onClick={() => navigate(`/tire-orders/${detail.selected.installOrderId}`)}>Mở đơn xuất</Button>}<Button variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={() => setDetail(null)}>Đóng</Button></Stack></Box><Box className="tire-lifecycle-drawer-body">
        <Paper variant="outlined" className="tire-lifecycle-drawer-section"><Typography variant="h6">Thông tin xe và vị trí lốp</Typography><Box className="tire-lifecycle-drawer-summary"><Box className="tire-lifecycle-drawer-summary-fields"><Typography>Biển số xe <strong>{detail.selected.licensePlate}</strong></Typography><Typography>Loại xe <strong>{detail.selected.wheelCount} bánh</strong></Typography><Typography>Vị trí lốp <strong>{detail.selected.positionNumber}</strong></Typography><Typography component="div">Trạng thái hiện tại <StatusChip status={currentLifecycle?.status || 'ended'} /> {currentLifecycle?.installOrderDeleted && <Chip size="small" color="error" label="Đơn đã xóa" />}</Typography><Typography>Lốp hiện tại <strong>{currentLifecycle ? `${currentLifecycle.productCode || '—'} - ${currentLifecycle.productName}` : '—'}</strong></Typography><Typography>Seri hiện tại <strong>{currentLifecycle?.serialNumber || '—'}</strong></Typography><Typography>Ngày bắt đầu <strong>{formatDate(currentLifecycle?.startedAt)}</strong></Typography><Typography>Thời điểm ngưng hoạt động <strong>{formatDateTime(currentLifecycle?.endedAt)}</strong></Typography><Typography>Thời gian sử dụng <strong>{currentLifecycle ? formatDuration(currentLifecycle.startedAt, currentLifecycle.endedAt) : '—'}</strong></Typography><Typography component="div">Đơn xuất <OrderReference id={currentLifecycle?.installOrderId} name={currentLifecycle?.installOrderName} deleted={currentLifecycle?.installOrderDeleted} navigate={navigate} /></Typography><Typography component="div">Đơn xuất kế tiếp <OrderReference id={currentLifecycle?.replacementOrderId} name={currentLifecycle?.replacementOrderName} deleted={currentLifecycle?.replacementOrderDeleted} navigate={navigate} /></Typography></Box><Box className="tire-lifecycle-mini-chassis"><TireChassis wheelCount={detail.selected.wheelCount} selectedSlotIds={[detail.selected.slotId]} /></Box></Box></Paper>
        <Paper variant="outlined" className="tire-lifecycle-drawer-section"><Typography variant="h6">Timeline vòng đời lốp</Typography><Box className="tire-lifecycle-timeline">{detail.chain.map((item, index) => <TireLifecycleTimelineItem key={item._id} item={item} index={index} navigate={navigate} />)}</Box></Paper>
        <Paper variant="outlined" className="tire-lifecycle-drawer-section"><Typography variant="h6">Liên kết đơn liên quan</Typography><Box className="tire-lifecycle-related-orders"><Box><Typography>Đơn xuất</Typography><OrderReference id={detail.selected.installOrderId} name={detail.selected.installOrderName} deleted={detail.selected.installOrderDeleted} navigate={navigate} endIcon /><Typography>Ngày thay: {formatDate(detail.selected.startedAt)}</Typography></Box><Box><Typography>Đơn xuất kế tiếp</Typography><OrderReference id={detail.selected.replacementOrderId} name={detail.selected.replacementOrderName} deleted={detail.selected.replacementOrderDeleted} navigate={navigate} endIcon /><Typography>Ngưng hoạt động: {formatDateTime(detail.selected.endedAt)}</Typography></Box></Box></Paper>
      </Box></>}
    </Drawer>
  </Box>;
};

export default TireLifecycles;

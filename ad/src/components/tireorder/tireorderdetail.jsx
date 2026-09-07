import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EditIcon from '@mui/icons-material/Edit';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { addTireAssignments, addTireOrderVehicle, completeTireOrder, createVehicle, deleteTireAssignment, deleteTireOrder, deleteVehicle, getActiveVehicleTires, getTireOrder, listTireProductOptions, listVehicles, moveTireAssignment, removeTireOrderVehicle, replaceTireAssignmentSlot, revertTireOrder, updateTireAssignment, updateTireOrder } from '../../api/tireOrderAdministrationApi';
import { usePermissions } from '../../context/permissioncontext';
import TireChassis from './TireChassis';
import { getTireSlots } from './tireSlots';
import '../style/tireorderdetail.css';
import '../style/tireorderdetail-overrides.css';

const dateText = (value) => value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const toDateTimeLocal = (value) => { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const currentDateTimeLocal = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};
const formatExportPrice = (value) => {
  if (value === undefined || value === null || value === '') return '—';
  const amount = Number(String(value).replace(/[^0-9-]/g, ''));
  return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')} VNĐ` : `${value} VNĐ`;
};

const TireOrderDetail = () => {
  const { id } = useParams(); const navigate = useNavigate(); const { can } = usePermissions();
  const [order, setOrder] = useState(null); const [selectedVehicleId, setSelectedVehicleId] = useState(''); const [vehicleDialog, setVehicleDialog] = useState(false); const [vehicleToDelete, setVehicleToDelete] = useState(null); const [vehicleDeleteLoading, setVehicleDeleteLoading] = useState(false); const [assignmentDialog, setAssignmentDialog] = useState(false); const [vehicles, setVehicles] = useState([]); const [vehicleFilter, setVehicleFilter] = useState('all'); const [vehicleWheelCount, setVehicleWheelCount] = useState(10); const [products, setProducts] = useState([]); const [product, setProduct] = useState(null); const [variantIndex, setVariantIndex] = useState(''); const [quantity, setQuantity] = useState(1); const [slotIds, setSlotIds] = useState([]); const [serialNumbersBySlot, setSerialNumbersBySlot] = useState({}); const [serialErrorsBySlot, setSerialErrorsBySlot] = useState({}); const [activeTires, setActiveTires] = useState([]); const [activeTiresLoading, setActiveTiresLoading] = useState(false); const [stoppedAtBySlot, setStoppedAtBySlot] = useState({}); const [highlighted, setHighlighted] = useState(null); const [editingAssignment, setEditingAssignment] = useState(null); const [performedAt, setPerformedAt] = useState(''); const [assignmentNote, setAssignmentNote] = useState(''); const [replacement, setReplacement] = useState(null); const [newVehiclePlate, setNewVehiclePlate] = useState(''); const [newVehicleName, setNewVehicleName] = useState(''); const [confirmationAction, setConfirmationAction] = useState(null); const [confirmationLoading, setConfirmationLoading] = useState(false);
  const apply = (next) => { setOrder(next); setSelectedVehicleId((current) => current && next.vehicles.some((vehicle) => vehicle._id === current) ? current : next.vehicles[0]?._id || ''); };
  const load = async () => { try { apply((await getTireOrder(id)).order); } catch (error) { toast.error(error.message); navigate('/tire-orders'); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);
  const selectedVehicle = order?.vehicles.find((vehicle) => vehicle._id === selectedVehicleId); const editable = order?.status === 'processing' && can('tireorder.edit');
  const saveOrder = async (body) => { try { apply((await updateTireOrder(id, { ...body, expectedVersion: order.version })).order); } catch (error) { toast.error(error.message); load(); } };
  const openVehicles = async () => { try { setVehicles((await listVehicles({ isActive: 'true', limit: 100 })).items); setVehicleFilter('all'); setVehicleWheelCount(10); setNewVehiclePlate(''); setNewVehicleName(''); setVehicleDialog(true); } catch (error) { toast.error(error.message); } };
  const addVehicle = async (vehicle) => { try { apply((await addTireOrderVehicle(id, { vehicleId: vehicle._id, wheelCount: vehicle.wheelCount || 10, expectedVersion: order.version })).order); setVehicleDialog(false); } catch (error) { toast.error(error.message); } };
  const createNewVehicle = async () => { if (!newVehiclePlate.trim()) return; try { const { vehicle } = await createVehicle({ licensePlate: newVehiclePlate.trim(), name: newVehicleName.trim(), wheelCount: vehicleWheelCount }); setVehicles((current) => [...current, vehicle]); setVehicleFilter(String(vehicleWheelCount)); setNewVehiclePlate(''); setNewVehicleName(''); toast.success('Đã tạo xe.'); } catch (error) { toast.error(error.message); } };
  const confirmDeleteVehicle = async () => {
    if (!vehicleToDelete || vehicleDeleteLoading) return;
    setVehicleDeleteLoading(true);
    try {
      await deleteVehicle(vehicleToDelete._id, { expectedVersion: vehicleToDelete.version });
      setVehicles((current) => current.filter((vehicle) => vehicle._id !== vehicleToDelete._id));
      toast.success(`Đã xóa xe ${vehicleToDelete.licensePlate}.`);
      setVehicleToDelete(null);
    } catch (error) { toast.error(error.message); } finally { setVehicleDeleteLoading(false); }
  };
  const openAssignment = async (assignment = null) => {
    setEditingAssignment(assignment);
    setProduct(null);
    setVariantIndex(assignment ? String(assignment.variantIndex) : '');
    setQuantity(1);
    setSlotIds([]);
    setSerialNumbersBySlot(assignment ? { [assignment.slotId]: assignment.serialNumber || '' } : {});
    setSerialErrorsBySlot({});
    setActiveTires([]);
    setStoppedAtBySlot(assignment?.previousTireStoppedAt ? { [assignment.slotId]: toDateTimeLocal(assignment.previousTireStoppedAt) } : {});
    setPerformedAt(assignment?.performedAt ? toDateTimeLocal(assignment.performedAt) : currentDateTimeLocal());
    setAssignmentNote(assignment?.note || '');
    setActiveTiresLoading(true);
    setAssignmentDialog(true);
    try {
      const [productResult, activeTireResult] = await Promise.all([
        listTireProductOptions({ limit: 100 }),
        getActiveVehicleTires(id, selectedVehicleId),
      ]);
      const options = productResult.items;
      setProducts(options);
      setActiveTires(activeTireResult.items || []);
      if (assignment) setProduct(options.find((item) => item._id === assignment.productId) || null);
    } catch (error) { setAssignmentDialog(false); toast.error(error.message); } finally { setActiveTiresLoading(false); }
  };
  const toggleSlot = (slotId) => {
    const removing = slotIds.includes(slotId);
    const maximum = Math.max(1, Number(quantity) || 1);
    const nextSlotIds = removing
      ? slotIds.filter((item) => item !== slotId)
      : slotIds.length >= maximum
        ? [...slotIds.slice(1), slotId]
        : [...slotIds, slotId];
    setStoppedAtBySlot((values) => {
      const next = Object.fromEntries(Object.entries(values).filter(([selectedSlotId]) => nextSlotIds.includes(selectedSlotId)));
      if (!removing && activeTires.some((item) => item.slotId === slotId) && !next[slotId]) next[slotId] = currentDateTimeLocal();
      return next;
    });
    setSerialNumbersBySlot((values) => Object.fromEntries(Object.entries(values).filter(([selectedSlotId]) => nextSlotIds.includes(selectedSlotId))));
    setSerialErrorsBySlot((values) => Object.fromEntries(Object.entries(values).filter(([selectedSlotId]) => nextSlotIds.includes(selectedSlotId))));
    setSlotIds(nextSlotIds);
  };
  const changeAssignmentQuantity = (value) => {
    const maximum = selectedVehicle?.wheelCount || 10;
    const nextQuantity = Math.max(1, Math.min(maximum, Number(value) || 1));
    const nextSlotIds = slotIds.slice(0, nextQuantity);
    setQuantity(nextQuantity);
    setSlotIds(nextSlotIds);
    setSerialNumbersBySlot((values) => Object.fromEntries(Object.entries(values).filter(([slotId]) => nextSlotIds.includes(slotId))));
    setSerialErrorsBySlot((values) => Object.fromEntries(Object.entries(values).filter(([slotId]) => nextSlotIds.includes(slotId))));
    setStoppedAtBySlot((values) => Object.fromEntries(Object.entries(values).filter(([slotId]) => nextSlotIds.includes(slotId))));
  };
  const saveAssignment = async () => {
    const variant = product?.variants[Number(variantIndex)];
    const affectedSlots = editingAssignment ? [editingAssignment.slotId] : slotIds;
    const oldTireSlots = affectedSlots.filter((slotId) => activeTires.some((item) => item.slotId === slotId));
    const normalizedSerials = affectedSlots.map((slotId) => (serialNumbersBySlot[slotId] || '').trim().normalize('NFKC').toLocaleUpperCase('vi-VN'));
    if (!product || !variant || normalizedSerials.some((value) => !value) || new Set(normalizedSerials).size !== normalizedSerials.length || (!editingAssignment && slotIds.length !== Number(quantity)) || oldTireSlots.some((slotId) => !stoppedAtBySlot[slotId])) return;
    const body = { productId: product._id, variantIndex: Number(variantIndex), variantId: variant._id, performedAt: performedAt || undefined, note: assignmentNote, expectedVersion: order.version };
    if (editingAssignment) { body.serialNumber = serialNumbersBySlot[editingAssignment.slotId].trim(); body.previousTireStoppedAt = stoppedAtBySlot[editingAssignment.slotId] || null; }
    else {
      body.serialNumbersBySlot = Object.fromEntries(slotIds.map((slotId) => [slotId, serialNumbersBySlot[slotId].trim()]));
      body.previousTireStoppedAtBySlot = Object.fromEntries(slotIds.filter((slotId) => stoppedAtBySlot[slotId]).map((slotId) => [slotId, stoppedAtBySlot[slotId]]));
    }
    try { const result = editingAssignment ? await updateTireAssignment(id, selectedVehicleId, editingAssignment._id, body) : await addTireAssignments(id, selectedVehicleId, { ...body, quantity: Number(quantity), slotIds }); apply(result.order); setAssignmentDialog(false); setEditingAssignment(null); } catch (error) {
      const conflictSerial = error.details?.normalizedSerial;
      const conflictSlots = conflictSerial ? affectedSlots.filter((slotId) => (serialNumbersBySlot[slotId] || '').trim().normalize('NFKC').toLocaleUpperCase('vi-VN') === conflictSerial) : [];
      if (error.code === 'TIRE_SERIAL_RESERVED' && conflictSlots.length) setSerialErrorsBySlot((current) => ({ ...current, ...Object.fromEntries(conflictSlots.map((slotId) => [slotId, error.message])) }));
      else toast.error(error.message);
    }
  };
  const move = async (slotId) => { if (!editable || !highlighted || slotId === highlighted.slotId) return; try { apply((await moveTireAssignment(id, selectedVehicleId, highlighted._id, { slotId, expectedVersion: order.version })).order); setHighlighted(null); } catch (error) { toast.error(error.message); } };
  const confirmReplacement = async () => { if (!replacement || !highlighted) return; try { apply((await replaceTireAssignmentSlot(id, selectedVehicleId, highlighted._id, { replacedAssignmentId: replacement._id, slotId: replacement.slotId, confirm: true, expectedVersion: order.version })).order); setHighlighted(null); setReplacement(null); } catch (error) { toast.error(error.message); } };
  const removeAssignment = async (assignment) => { try { apply((await deleteTireAssignment(id, selectedVehicleId, assignment._id, { expectedVersion: order.version })).order); setHighlighted(null); } catch (error) { toast.error(error.message); } };
  const runConfirmedAction = async () => {
    if (!confirmationAction || confirmationLoading) return;
    setConfirmationLoading(true);
    try {
      if (confirmationAction === 'complete') {
        apply((await completeTireOrder(id, { expectedVersion: order.version })).order);
        toast.success('Đã hoàn thành đơn lốp.');
      } else if (confirmationAction === 'revert') {
        apply((await revertTireOrder(id, { expectedVersion: order.version })).order);
        toast.success('Đã hủy hoàn thành và hoàn lại tồn kho.');
      } else if (confirmationAction === 'delete') {
        await deleteTireOrder(id, { expectedVersion: order.version });
        toast.success('Đã xóa đơn lốp.');
        navigate('/tire-orders');
      } else if (confirmationAction === 'removeVehicle') {
        apply((await removeTireOrderVehicle(id, selectedVehicleId, { expectedVersion: order.version })).order);
        toast.success('Đã xóa xe khỏi đơn.');
      }
      setConfirmationAction(null);
    } catch (error) { toast.error(error.message); } finally { setConfirmationLoading(false); }
  };
  const confirmationContent = {
    complete: { title: 'Xác nhận hoàn thành đơn', message: 'Hoàn thành đơn sẽ trừ tồn kho của toàn bộ lốp trong đơn và khóa các thay đổi ảnh hưởng đến kho. Bạn có chắc chắn muốn tiếp tục?', button: 'Hoàn thành đơn', color: 'primary' },
    revert: { title: 'Xác nhận hủy hoàn thành', message: 'Hủy hoàn thành sẽ hoàn lại toàn bộ số lốp đã trừ kho và đưa đơn về trạng thái đang xử lý. Bạn có chắc chắn muốn tiếp tục?', button: 'Hủy hoàn thành', color: 'warning' },
    delete: { title: 'Xác nhận xóa đơn', message: 'Bạn có chắc chắn muốn xóa đơn này không?', button: 'Xóa đơn', color: 'error' },
    removeVehicle: { title: 'Xác nhận xóa xe khỏi đơn', message: 'Xe và toàn bộ lốp đã gán cho xe trong đơn này sẽ bị xóa. Bạn có chắc chắn muốn tiếp tục?', button: 'Xóa xe', color: 'error' },
  }[confirmationAction];
  const availableVehicles = vehicles.filter((vehicle) => !order?.vehicles.some((entry) => entry.vehicleId === vehicle._id));
  const filteredVehicles = availableVehicles.filter((vehicle) => vehicleFilter === 'all' || Number(vehicle.wheelCount || 10) === Number(vehicleFilter));
  const tenWheelVehicles = availableVehicles.filter((vehicle) => Number(vehicle.wheelCount || 10) === 10).length;
  const twelveWheelVehicles = availableVehicles.filter((vehicle) => Number(vehicle.wheelCount || 10) === 12).length;
  const assignmentSlots = editingAssignment ? [editingAssignment.slotId] : slotIds;
  const tiresBeingStopped = activeTires.filter((item) => assignmentSlots.includes(item.slotId));
  const normalizedAssignmentSerials = assignmentSlots.map((slotId) => (serialNumbersBySlot[slotId] || '').trim().normalize('NFKC').toLocaleUpperCase('vi-VN'));
  const hasMissingSerial = assignmentSlots.length !== (editingAssignment ? 1 : Number(quantity)) || normalizedAssignmentSerials.some((value) => !value);
  const hasDuplicateSerial = normalizedAssignmentSerials.filter(Boolean).length !== new Set(normalizedAssignmentSerials.filter(Boolean)).size;
  const hasInvalidStoppedAt = tiresBeingStopped.some((item) => {
    const value = stoppedAtBySlot[item.slotId];
    return !value || (performedAt && value > performedAt) || (item.startedAt && value < toDateTimeLocal(item.startedAt));
  });
  if (!order) return null;
  return <Box className="inventory-order-detail-page tire-order-detail" p={2}>
    <Paper className="tire-order-info">
      <Box className="tire-order-info-head"><Typography variant="h5">Thông tin đơn</Typography><Stack direction="row" spacing={1}>{editable && <Button variant="contained" startIcon={<CheckCircleIcon />} onClick={() => setConfirmationAction('complete')}>Hoàn thành đơn</Button>}{order.status === 'completed' && can('tireorder.edit') && <Button variant="outlined" onClick={() => setConfirmationAction('revert')}>Hủy hoàn thành</Button>}</Stack></Box>
      <Box className="tire-order-info-grid tire-order-info-grid-with-note">
        <Box className="tire-order-info-field"><Typography className="tire-order-info-label">Tên đơn</Typography><TextField className="tire-order-name-input" fullWidth value={order.orderName} onChange={(event) => setOrder({ ...order, orderName: event.target.value })} onBlur={() => saveOrder({ orderName: order.orderName })} /></Box>
        <Box className="tire-order-info-field"><Typography className="tire-order-info-label">Ghi chú</Typography><TextField className="tire-order-name-input" fullWidth value={order.note || ''} onChange={(event) => setOrder({ ...order, note: event.target.value })} onBlur={() => saveOrder({ note: order.note || '' })} /></Box>
        <Box className="tire-order-info-field"><Typography className="tire-order-info-label">Ngày thực hiện</Typography><TextField fullWidth type="datetime-local" InputLabelProps={{ shrink: true }} value={toDateTimeLocal(order.transactionDate)} disabled={!editable} onChange={(event) => setOrder({ ...order, transactionDate: event.target.value })} onBlur={(event) => saveOrder({ transactionDate: event.target.value })} /></Box>
        <Box className="tire-order-info-field"><Typography className="tire-order-info-label">Người tạo</Typography><Typography className="tire-order-info-value">{order.createdByName}</Typography></Box>
        <Box className="tire-order-info-field"><Typography className="tire-order-info-label">Tổng số xe</Typography><Typography className="tire-order-info-value">{order.totalVehicles}</Typography></Box>
        <Box className="tire-order-info-field"><Typography className="tire-order-info-label">Tổng số lốp</Typography><Typography className="tire-order-info-value">{order.totalTires}</Typography></Box>
      </Box>
    </Paper>
    <Paper className="tire-order-vehicle-tabs"><Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>{<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{order.vehicles.map((vehicle) => <Button key={vehicle._id} className={`tire-order-tab ${vehicle._id === selectedVehicleId ? 'selected' : ''}`} variant="outlined" startIcon={<DirectionsCarIcon />} onClick={() => { setSelectedVehicleId(vehicle._id); setHighlighted(null); }}>{vehicle.licensePlateSnapshot} · {vehicle.wheelCount || 10} bánh · {vehicle.assignments.length} lốp</Button>)}</Stack>}{editable && <Button variant="outlined" startIcon={<AddIcon />} onClick={openVehicles}>Thêm xe</Button>}</Stack></Paper>
    {selectedVehicle && <Box className="tire-order-workspace"><Paper className="tire-order-panel tire-order-chassis-panel" onClick={() => setHighlighted(null)}><Box className="tire-order-panel-head"><Typography variant="h6">Sơ đồ lốp xe {selectedVehicle.licensePlateSnapshot}</Typography></Box><TireChassis assignments={selectedVehicle.assignments} wheelCount={selectedVehicle.wheelCount || 10} highlightedAssignmentId={highlighted?._id} selectable={Boolean(highlighted)} allowOccupiedClick={Boolean(highlighted)} onBackgroundClick={() => setHighlighted(null)} onSlotClick={(slotId, assignment) => { if (assignment && highlighted?._id === assignment._id) setHighlighted(null); else if (assignment && highlighted) setReplacement(assignment); else if (assignment) setHighlighted(assignment); else move(slotId); }} /><Box className="tire-order-legend"><span><i className="empty" />Chưa có lốp trong đơn</span><span><i className="assigned" />Lốp trong đơn</span><span><i className="selected" />Đang chọn</span></Box></Paper><Paper className="tire-order-panel"><Box className="tire-order-panel-head"><Typography variant="h6">Danh sách lốp của xe {selectedVehicle.licensePlateSnapshot}</Typography>{editable && <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openAssignment()}>Thêm lốp</Button>}</Box><TableContainer className="tire-order-tires-table"><Table><TableHead><TableRow><TableCell>Mã sản phẩm</TableCell><TableCell>Mã lốp</TableCell><TableCell>Tên sản phẩm</TableCell><TableCell>Thương hiệu</TableCell><TableCell>Giá xuất</TableCell><TableCell>Ngày thay</TableCell><TableCell align="center">Thao tác</TableCell></TableRow></TableHead><TableBody>{selectedVehicle.assignments.map((assignment) => <TableRow key={assignment._id} hover selected={highlighted?._id === assignment._id} onMouseEnter={() => setHighlighted(assignment)} onMouseLeave={() => setHighlighted(null)} onClick={() => setHighlighted(assignment)}><TableCell>{assignment.productCodeSnapshot}</TableCell><TableCell>{assignment.serialNumber || '—'}</TableCell><TableCell>{assignment.productNameSnapshot}</TableCell><TableCell>{assignment.brandSnapshot || '—'}</TableCell><TableCell>{formatExportPrice(assignment.exportPriceSnapshot)}</TableCell><TableCell>{assignment.performedAt ? new Date(assignment.performedAt).toLocaleDateString('vi-VN') : '—'}</TableCell><TableCell align="center">{editable && <><IconButton color="primary" onClick={(event) => { event.stopPropagation(); openAssignment(assignment); }}><EditIcon fontSize="small" /></IconButton><IconButton color="error" onClick={(event) => { event.stopPropagation(); removeAssignment(assignment); }}><DeleteIcon fontSize="small" /></IconButton></>}</TableCell></TableRow>)}</TableBody></Table></TableContainer>{editable && <Button color="error" size="small" sx={{ alignSelf: 'flex-start', mt: 1.5 }} onClick={() => setConfirmationAction('removeVehicle')}>Xóa xe khỏi đơn</Button>}</Paper></Box>}
    <Dialog open={vehicleDialog} onClose={() => setVehicleDialog(false)} fullWidth maxWidth="md">
      <DialogTitle>Chọn xe</DialogTitle>
      <DialogContent>
        <TextField select fullWidth label="Lọc theo loại xe" InputLabelProps={{ shrink: true }} SelectProps={{ native: true }} value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)} sx={{ mt: 1.5, mb: 2 }}><option value="all">Tất cả ({availableVehicles.length})</option><option value="10">Xe 10 bánh ({tenWheelVehicles})</option><option value="12">Xe 12 bánh ({twelveWheelVehicles})</option></TextField>
        <Stack className="tire-vehicle-options-list" spacing={1}>
          {filteredVehicles.map((vehicle) => <Box className="tire-vehicle-option-row" key={vehicle._id}>
            <Button fullWidth className={`tire-vehicle-option tire-vehicle-option-${vehicle.wheelCount || 10}`} variant="outlined" startIcon={<DirectionsCarIcon />} onClick={() => addVehicle(vehicle)}>{vehicle.licensePlate} · {vehicle.wheelCount || 10} bánh {vehicle.name ? `— ${vehicle.name}` : ''}</Button>
            {can('tireorder.delete') && <IconButton className="tire-vehicle-option-delete" color="error" title={`Xóa xe ${vehicle.licensePlate}`} aria-label={`Xóa xe ${vehicle.licensePlate}`} onClick={() => setVehicleToDelete(vehicle)}><DeleteIcon /></IconButton>}
          </Box>)}
          {!filteredVehicles.length && <Typography color="text.secondary">Không có xe phù hợp với bộ lọc.</Typography>}
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Tạo xe mới</Typography>
        <Box className="tire-vehicle-create-row"><TextField className="tire-vehicle-create-plate" label="Biển số xe" value={newVehiclePlate} onChange={(event) => setNewVehiclePlate(event.target.value)} /><TextField className="tire-vehicle-create-wheel-count" select label="Loại xe" InputLabelProps={{ shrink: true }} SelectProps={{ native: true }} value={vehicleWheelCount} onChange={(event) => setVehicleWheelCount(Number(event.target.value))}><option value={10}>10 bánh</option><option value={12}>12 bánh</option></TextField><TextField className="tire-vehicle-create-name" label="Tên hoặc mô tả xe" value={newVehicleName} onChange={(event) => setNewVehicleName(event.target.value)} /><Button className="tire-vehicle-create-button" variant="outlined" disabled={!newVehiclePlate.trim()} onClick={createNewVehicle}>Tạo xe</Button></Box>
      </DialogContent>
      <DialogActions><Button onClick={() => setVehicleDialog(false)}>Đóng</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(vehicleToDelete)} onClose={() => !vehicleDeleteLoading && setVehicleToDelete(null)} fullWidth maxWidth="xs">
      <DialogTitle>Xác nhận xóa xe</DialogTitle>
      <DialogContent><Typography>Bạn có chắc chắn muốn xóa xe <strong>{vehicleToDelete?.licensePlate}</strong> không?</Typography></DialogContent>
      <DialogActions><Button disabled={vehicleDeleteLoading} onClick={() => setVehicleToDelete(null)}>Hủy</Button><Button color="error" variant="contained" disabled={vehicleDeleteLoading} onClick={confirmDeleteVehicle}>{vehicleDeleteLoading ? 'Đang xóa...' : 'Xóa xe'}</Button></DialogActions>
    </Dialog>
    <Dialog open={assignmentDialog} onClose={() => setAssignmentDialog(false)} fullWidth maxWidth="md">
      <DialogTitle>{editingAssignment ? 'Sửa lốp' : 'Thêm lốp'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Autocomplete value={product} options={products} getOptionLabel={(option) => `${option.code ? `${option.code} — ` : ''}${option.name}`} onChange={(_, value) => { setProduct(value); setVariantIndex(value?.variants.length === 1 ? '0' : ''); }} renderInput={(params) => <TextField {...params} label="Sản phẩm lốp" />} />
          {product?.variants.length > 1 && <TextField select SelectProps={{ native: true }} label="Phiên bản" InputLabelProps={{ shrink: true }} value={variantIndex} onChange={(event) => setVariantIndex(event.target.value)}><option value="">Chọn phiên bản</option>{product.variants.map((variant) => <option key={variant._id} value={variant.index}>{[variant.color, variant.shape, variant.frame].filter(Boolean).join(' / ') || `Phiên bản ${variant.index + 1}`}</option>)}</TextField>}
          {Array.from({ length: editingAssignment ? 1 : Number(quantity) }, (_, index) => {
            const slotId = editingAssignment?.slotId || slotIds[index];
            const positionNumber = slotId ? getTireSlots(selectedVehicle?.wheelCount).indexOf(slotId) + 1 : 0;
            const value = slotId ? serialNumbersBySlot[slotId] || '' : '';
            const normalized = value.trim().normalize('NFKC').toLocaleUpperCase('vi-VN');
            const duplicated = normalized && normalizedAssignmentSerials.filter((item) => item === normalized).length > 1;
            const serverError = serialErrorsBySlot[slotId];
            return <TextField key={slotId || `empty-${index}`} required disabled={!slotId} label={Number(quantity) > 1 ? `Mã lốp ${index + 1}${positionNumber ? ` — Vị trí ${positionNumber}` : ''}` : 'Mã lốp'} value={value} onChange={(event) => { setSerialNumbersBySlot((current) => ({ ...current, [slotId]: event.target.value })); setSerialErrorsBySlot((current) => ({ ...current, [slotId]: '' })); }} error={Boolean(serverError || duplicated)} helperText={!slotId ? 'Chọn vị trí lốp bên dưới để nhập mã lốp.' : serverError || (duplicated ? 'Mã lốp không được trùng trong cùng lần thêm.' : 'Mã riêng của từng chiếc lốp, không lưu vào sản phẩm.')} FormHelperTextProps={serverError ? { sx: { fontSize: '0.875rem', fontWeight: 500 } } : undefined} />;
          })}
          <TextField type="datetime-local" label="Ngày thay" InputLabelProps={{ shrink: true }} value={performedAt} onChange={(event) => setPerformedAt(event.target.value)} />
          {tiresBeingStopped.map((tire) => <Alert key={tire.slotId} severity="warning" variant="outlined">
            <Typography sx={{ mb: 1 }}>Vị trí {tire.positionNumber} đang có lốp cũ: <strong>{tire.productCode || '—'} — {tire.productName}</strong>{tire.serialNumber ? <> — Mã lốp: <strong>{tire.serialNumber}</strong></> : null} - Ngày thay trước: <strong>{dateText(tire.startedAt)}</strong></Typography>
            <TextField fullWidth required type="datetime-local" label="Thời điểm ngưng hoạt động" InputLabelProps={{ shrink: true }} inputProps={{ min: toDateTimeLocal(tire.startedAt), max: performedAt || undefined }} value={stoppedAtBySlot[tire.slotId] || ''} onChange={(event) => setStoppedAtBySlot((current) => ({ ...current, [tire.slotId]: event.target.value }))} error={!stoppedAtBySlot[tire.slotId] || (performedAt && stoppedAtBySlot[tire.slotId] > performedAt) || stoppedAtBySlot[tire.slotId] < toDateTimeLocal(tire.startedAt)} helperText="Mặc định là thời điểm chọn bánh; có thể sửa nhưng không được sau ngày thay lốp." />
          </Alert>)}
          <TextField label="Ghi chú" value={assignmentNote} onChange={(event) => setAssignmentNote(event.target.value)} multiline minRows={2} />
          {!editingAssignment && <>
            <TextField type="number" label="Số lượng" inputProps={{ min: 1, max: selectedVehicle?.wheelCount || 10 }} value={quantity} onChange={(event) => changeAssignmentQuantity(event.target.value)} helperText={`Đã chọn ${slotIds.length}/${quantity} vị trí`} />
            {activeTiresLoading ? <Typography color="text.secondary">Đang kiểm tra lốp cũ trên xe...</Typography> : <Box className="tire-assignment-chassis-wrap"><TireChassis assignments={selectedVehicle?.assignments || []} wheelCount={selectedVehicle?.wheelCount || 10} selectedSlotIds={slotIds} selectable onSlotClick={(slotId) => toggleSlot(slotId)} /></Box>}
          </>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={() => setAssignmentDialog(false)}>Hủy</Button><Button variant="contained" disabled={activeTiresLoading || !product || variantIndex === '' || hasMissingSerial || hasDuplicateSerial || hasInvalidStoppedAt || (!editingAssignment && slotIds.length !== Number(quantity))} onClick={saveAssignment}>Lưu</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(confirmationAction)} onClose={() => !confirmationLoading && setConfirmationAction(null)} fullWidth maxWidth="xs"><DialogTitle>{confirmationContent?.title}</DialogTitle><DialogContent><Typography>{confirmationContent?.message}</Typography></DialogContent><DialogActions><Button disabled={confirmationLoading} onClick={() => setConfirmationAction(null)}>Hủy</Button><Button variant="contained" color={confirmationContent?.color || 'primary'} disabled={confirmationLoading} onClick={runConfirmedAction}>{confirmationLoading ? 'Đang xử lý...' : confirmationContent?.button}</Button></DialogActions></Dialog>
    <Dialog open={Boolean(replacement)} onClose={() => setReplacement(null)}><DialogTitle>Xác nhận thay thế vị trí</DialogTitle><DialogContent><Typography>Vị trí đã chọn đang có lốp. Xác nhận thay thế lốp hiện tại tại vị trí này?</Typography></DialogContent><DialogActions><Button onClick={() => setReplacement(null)}>Hủy</Button><Button color="warning" variant="contained" onClick={confirmReplacement}>Xác nhận thay thế</Button></DialogActions></Dialog>
  </Box>;
};

export default TireOrderDetail;

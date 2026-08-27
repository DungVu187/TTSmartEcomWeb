const service = require('../services/tireLifecycleService');

const sendError = (res, error) => res.status(error?.statusCode || 500).json({ success: false, code: error?.code, message: error?.message || 'Lỗi server.' });
const list = async (req, res) => { try { res.json({ success: true, data: await service.listTireLifecycles(req.query) }); } catch (error) { sendError(res, error); } };
const detail = async (req, res) => { try { res.json({ success: true, data: await service.getTireLifecycleDetail(req.params.id) }); } catch (error) { sendError(res, error); } };

module.exports = { list, detail };

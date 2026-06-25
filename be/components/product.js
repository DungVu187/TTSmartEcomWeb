const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { authenticateUser, authenticateAdmin, checkPermission, User } = require('./user');
const { Station } = require('./station');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();
const fs = require('fs').promises;
const { StorageHistory } = require("./storagehistory");

function removeVietnameseTones(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}


const productSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        trim: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    nameUnsigned: {
        type: String,
        trim: true,
        index: true
    },
    display: {
        type: Boolean,
        default: 1
    },
    code: {
        type: String,
        trim: true
    },
    brand: {
        type: String,
        required: true,
        trim: true,
    },
    section: {
        type: String,
        required: true,
    },
    value: {
        type: String,
        required: true,
    },
    variant: {
        type: [
            {
                price: { type: String, default: "" },
                importPrice: { type: String, default: ""},
                earn: { type: Number, default: 0},
                imgUrl: { type: String, default: "" },
                color: { type: String, default: "" },
                shape: { type: String, default: "" },
                buttonCount: { type: String, default: "" },
                frame: { type: String, default: "" },
                quantityForSale: { type: Number, default: 0 },
                quantityInStorage: { type: Number, default: 0 },
                note: { type: String, default: "" }
            }
        ],
        default: [{
            price: "",
            imgUrl: "",
            color: "",
            shape: "",
            buttonCount: "",
            frame: "",
            quantityForSale: 0,
            quantityInStorage: 0,
            note: ""
        }]
    },
    infoDoc: {
        type: {
            manual: { type: String, default: "" },
            dataSheet: { type: String, default: "" },
            catalog: { type: String, default: "" },
            others: { type: String, default: "" }
        },
    },
    purchaseCount: {
        type: Number,
        required: true,
        default: 0,
    },
    reviews: [
        {
            email: { type: String, required: true },
            comment: { type: String, default: "" },
            rating: { type: Number, min: 1, max: 5, required: true },
            createdAt: { type: Date, default: Date.now },
        }
    ],
    totalRating: {
        type: Number,
        default: 0,
    },
    reviewCount: {
        type: Number,
        default: 0,
    },
    averageReviews: {
        type: Number,
        default: 0,
    },
    warranty: {
        type: String,
        required: true,
    },
    solution: {
        type: String,
        default: "",
    },
    description: {
        type: String,
        default: "",
    },
    features: {
        type: String,
        default: "",
    },
    operatingMethod: {
        type: String,
        default: "",
    },
    advantages: {
        type: String,
        default: "",
    },
    specifications: {
        type: String,
        default: "",
    }
}, { timestamps: true });

productSchema.pre('save', function(next) {
    if (this.isModified('name')) {
        this.nameUnsigned = removeVietnameseTones(this.name);
    }
    next();
});

const getUpdatedImgUrl = (originalUrl) => {
  if (!originalUrl) return originalUrl;

  const paths = ['/images/', '/station/', '/section-images/'];
  for (const p of paths) {
    const idx = originalUrl.indexOf(p);
    if (idx !== -1) {
      return originalUrl.substring(idx);
    }
  }
  return originalUrl;
};

productSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.variant && Array.isArray(ret.variant)) {
      ret.variant.forEach(v => {
        if (v.imgUrl) {
          v.imgUrl = getUpdatedImgUrl(v.imgUrl);
        }
      });
    }
    return ret;
  }
});

productSchema.set('toObject', {
  transform: (doc, ret) => {
    if (ret.variant && Array.isArray(ret.variant)) {
      ret.variant.forEach(v => {
        if (v.imgUrl) {
          v.imgUrl = getUpdatedImgUrl(v.imgUrl);
        }
      });
    }
    return ret;
  }
});

const Product = mongoose.model('Product', productSchema);

// Tạo router cho các API sản phẩm
const router = express.Router();

// Cấu hình multer để lưu ảnh vào thư mục 'upload'
const imageStorage = multer.diskStorage({
    destination: "./upload/images",
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const uploadImage = multer({ storage: imageStorage });

router.post("/upload/image", [authenticateAdmin, checkPermission('update_product')], uploadImage.single('product'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: 0, message: "Không có file được upload" });
    }
    const imgUrl = `${process.env.ADDRESS}/images/${req.file.filename}`;
    res.json({
        success: 1,
        imgUrl: imgUrl
    });
});

// API xóa ảnh
router.delete('/:id/:variantIndex/image', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id, variantIndex } = req.params;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(404).json({ message: 'Variant not found' });
        }
        const imgUrl = product.variant[index].imgUrl;
        if (imgUrl) {
            const filename = imgUrl.split('/images/')[1];
            const filePath = path.join(__dirname, '../upload/images', filename);
            try {
                await fs.unlink(filePath);
            } catch (err) {
                console.error('Error deleting file:', err);
            }
            product.variant[index].imgUrl = "";
            await product.save();
            return res.status(200).json({ message: 'Image deleted successfully', product });
        }
        return res.status(400).json({ message: 'No image to delete' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// API tạo sản phẩm mới
router.post('/create', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { type, name, code, brand, warranty, solution, description, features, operatingMethod, advantages, specifications, variant, section, value, infoDoc } = req.body;
        const newProduct = new Product({
            type, name, code, brand, warranty, solution, description, features, operatingMethod, advantages, specifications, variant, section, value, infoDoc
        });
        await newProduct.save();
        res.status(201).json({ message: 'Product created successfully', product: newProduct });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API lấy tất cả sản phẩm
router.get("/", async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 100,
            search = "",
            code = "",
            type, 
            brand, 
            section,
            value,
            sortBy = "purchaseCount",
            sortOrder = "desc",
            display,
            stationId
        } = req.query;

        // Chuyển đổi và đảm bảo page, limit hợp lệ
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 100);
        const skip = (pageNum - 1) * limitNum;

        // Tạo bộ lọc
        const filter = {};
        if (search && search !== "") {
            const searchUnsigned = removeVietnameseTones(search);
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { nameUnsigned: { $regex: searchUnsigned, $options: "i" } },
                { code: { $regex: search, $options: "i" } },
                { brand: { $regex: search, $options: "i" } }
            ];
        }
        if (code && code !== "") filter.code = { $regex: code, $options: "i" };
        if (type && type !== "") filter.type = type;
        if (brand && brand !== "") filter.brand = brand;
        if (section && section !== "") filter.section = section;
        if (value && value !== "") filter.value = value;
        if (display !== undefined) filter.display = display === "true"; 

        // Kiểm tra cookie authToken để thực hiện lọc theo trạm trộn của khách hàng
        const token = req.cookies?.authToken;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId);
                if (user && user.role === "customer") {
                    const userStations = user.station || [];
                    
                    if (userStations.length === 0) {
                        // Khách hàng không có trạm trộn nào -> Không hiển thị sản phẩm nào
                        return res.json({ total: 0, page: pageNum, limit: limitNum, products: [] });
                    }

                    let allowedProductIds = [];
                    
                    // Nếu khách hàng chọn lọc một trạm cụ thể từ dropdown
                    if (stationId && stationId !== "Tất cả") {
                        // Kiểm tra xem trạm này có thuộc sở hữu của khách hàng không
                        if (!userStations.includes(stationId)) {
                            return res.status(403).json({ message: "Bạn không có quyền truy cập trạm trộn này." });
                        }
                        const stationObj = await Station.findById(stationId);
                        if (stationObj && Array.isArray(stationObj.productId)) {
                            allowedProductIds = stationObj.productId;
                        }
                    } else {
                        // Nếu chọn "Tất cả" hoặc không truyền stationId -> Lấy sản phẩm của tất cả trạm của user
                        const stations = await Station.find({ _id: { $in: userStations } });
                        stations.forEach(s => {
                            if (Array.isArray(s.productId)) {
                                allowedProductIds.push(...s.productId);
                            }
                        });
                    }

                    // Loại bỏ trùng lặp và lọc
                    const uniqueProductIds = [...new Set(allowedProductIds)];
                    filter._id = { $in: uniqueProductIds };
                }
            } catch (err) {
                console.error("Lỗi xác thực token/trạm của khách hàng:", err.message);
                return res.json({ total: 0, page: pageNum, limit: limitNum, products: [] });
            }
        } else {
            // Khách vãng lai chưa đăng nhập -> Trả về danh sách trống
            return res.json({ total: 0, page: pageNum, limit: limitNum, products: [] });
        }

        // Xử lý sắp xếp
        const validSortFields = ["purchaseCount", "averageReviews", "createdAt"];
        const sortField = validSortFields.includes(sortBy) ? sortBy : "purchaseCount";
        const sortDirection = sortOrder === "asc" ? 1 : -1;

        const sortCriteria = { 
            [sortField]: sortDirection, 
            createdAt: -1 
        };

        // Truy vấn MongoDB
        const [products, total] = await Promise.all([
            Product.find(filter)
                .sort(sortCriteria)
                .skip(skip)
                .limit(limitNum),
            Product.countDocuments(filter)
        ]);

        const processedProducts = products.map(product => {
            const productObj = product.toJSON();
            return {
                ...productObj,
                purchaseCount: productObj.purchaseCount || 0,
                averageReviews: productObj.averageReviews || 0
            };
        });

        res.json({ 
            total, 
            page: pageNum, 
            limit: limitNum, 
            products: processedProducts 
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: "Server error. Please try again later." });
    }
});

// API lấy 10 sản phẩm có purchaseCount cao nhất
router.get('/top-purchased', async (req, res) => {
    try {
        const products = await Product.find()
            .sort({ purchaseCount: -1 }) // Sắp xếp giảm dần theo purchaseCount
            .limit(10);
        
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error });
    }
});

// API lấy thông tin sản phẩm theo ID (Public)
router.get('/:_id', async (req, res) => {
    try {
        const product = await Product.findById(req.params._id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API lấy thông tin nhiều sản phẩm qua mảng id
router.post('/fetch-by-ids', async (req, res) => {
    console.log('📨 API /fetch-by-ids body:', req.body);
    try {
        const { ids } = req.body;

        // Kiểm tra xem ids có phải là mảng không
        if (!Array.isArray(ids)) {
            return res.status(400).json({
                success: 0,
                message: 'Vui lòng cung cấp một mảng ids hợp lệ'
            });
        }

        // Nếu mảng rỗng, trả về kết quả rỗng luôn mà không cần query DB
        if (ids.length === 0) {
            return res.json({
                success: 1,
                total: 0,
                products: []
            });
        }

        // Chuyển đổi tất cả ids thành ObjectId và loại bỏ các giá trị không hợp lệ
        const validIds = ids
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        if (validIds.length === 0) {
            return res.status(400).json({
                success: 0,
                message: 'Không có id nào hợp lệ trong mảng'
            });
        }

        // Tìm các sản phẩm theo mảng ids
        const products = await Product.find({ _id: { $in: validIds } });

        // Xử lý kết quả để đảm bảo dữ liệu đầy đủ
        const processedProducts = products.map(product => {
            const productObj = product.toJSON();
            return {
                ...productObj,
                purchaseCount: productObj.purchaseCount || 0,
                averageReviews: productObj.averageReviews || 0,
                reviewCount: productObj.reviewCount || 0,
                totalRating: productObj.totalRating || 0
            };
        });

        res.json({
            success: 1,
            total: processedProducts.length,
            products: processedProducts
        });
    } catch (error) {
        console.error('Error fetching products by IDs:', error);
        res.status(500).json({
            success: 0,
            message: 'Lỗi server khi lấy thông tin sản phẩm',
            error: error.message
        });
    }
});

router.put('/update-display-field', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const result = await Product.updateMany(
            { display: { $exists: false } },
            { $set: { display: true } }
        );

        if (result.modifiedCount === 0) {
            return res.status(200).json({ 
                message: 'Không có sản phẩm nào cần cập nhật hoặc tất cả sản phẩm đã có trường display' 
            });
        }

        res.status(200).json({ 
            message: 'Cập nhật trường display thành công', 
            updatedCount: result.modifiedCount 
        });
    } catch (error) {
        console.error('Error updating display field:', error);
        res.status(500).json({ 
            message: 'Lỗi server khi cập nhật trường display', 
            error: error.message 
        });
    }
});

// API sửa thông tin sản phẩm
router.put('/:_id', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        console.log('[PUT /products/:_id] id =', req.params._id);
        console.log('[PUT /products/:_id] name in body =', req.body.name);
        if (req.body.name !== undefined) {
            req.body.nameUnsigned = removeVietnameseTones(req.body.name);
        }
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params._id,
            { $set: req.body },
            { new: true, runValidators: false }
        );
        console.log('[PUT /products/:_id] name saved =', updatedProduct?.name);
        console.log('[PUT /products/:_id] result =', updatedProduct ? 'found & updated' : 'NOT FOUND');
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(updatedProduct);
    } catch (error) {
        console.error('[PUT /products/:_id] error =', error.message);
        res.status(500).json({ message: error.message });
    }
});

// API tăng hoặc giảm số lượng sản phẩm đã mua
router.put("/purchase/:_id", async (req, res) => {
    try {
        const { action, amount } = req.body; // action: "increase" hoặc "decrease", amount: số lượng thay đổi
        const numericAmount = parseInt(amount, 10);

        if (!["increase", "decrease"].includes(action) || isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
        }

        const product = await Product.findById(req.params._id);
        if (!product) {
            return res.status(404).json({ message: "Sản phẩm không tồn tại" });
        }

        // Cập nhật purchaseCount theo amount
        if (action === "increase") {
            product.purchaseCount += numericAmount;
        } else if (action === "decrease") {
            product.purchaseCount = Math.max(0, product.purchaseCount - numericAmount); // Đảm bảo không âm
        }

        await product.save();
        res.json({ message: "Cập nhật thành công", purchaseCount: product.purchaseCount });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server", error: error.message });
    }
});

// API xóa sản phẩm
router.delete('/:_id', [authenticateAdmin, checkPermission('delete_product')], async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params._id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// API thêm mới variant 
router.post('/:id/variant', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id } = req.params;
    const newVariant = req.body;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        product.variant.push(newVariant);
        await product.save();
        return res.status(201).json({
            message: 'Variant added successfully',
            product,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// API thay đổi thuộc tính display của sản phẩm
router.put('/:_id/toggle-display', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    try {
        const { _id } = req.params;
        const product = await Product.findById(_id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.display = !product.display;
        await product.save();

        res.status(200).json({ 
            message: `Thay đổi hiển thị thành công`, 
            product 
        });
    } catch (error) {
        console.error('Error toggling display:', error);
        res.status(500).json({ 
            message: 'Lỗi server khi thay đổi display', 
            error: error.message 
        });
    }
});

// API để cập nhật số lượng bằng variantIndex
router.post("/:id/:variantIndex", [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id, variantIndex } = req.params;
    const { quantity, orderId, orderName } = req.body;
    const userName = req.user.name;

    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(400).json({ message: "Invalid variant index" });
        }

        const variant = product.variant[index];

        const change = Number(quantity);
        if (isNaN(change)) {
            return res.status(400).json({ message: "Quantity must be a number" });
        }

        const newQuantityForSale = variant.quantityForSale + change;
        const newQuantityInStorage = variant.quantityInStorage + change;

        if (newQuantityForSale < 0 || newQuantityInStorage < 0) {
            return res.status(400).json({
                message: `Không còn đủ số lượng trong kho cho sản phẩm: ${product.name}`
            });
        }

        variant.quantityForSale = newQuantityForSale;
        variant.quantityInStorage = newQuantityInStorage;
        await product.save();

        const history = new StorageHistory({
            productId: id,
            productName: product.name,
            quantity: change,
            userName: userName,
            orderId: orderId,
            orderName: orderName
        });
        await history.save();

        return res.status(200).json({
            message: "Quantity updated & history saved",
            product,
            history
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
});

// API chỉnh sửa variant đang tồn tại
router.put('/:id/:variantIndex', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id, variantIndex } = req.params;
    const variantData = req.body;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(404).json({ message: 'Variant not found' });
        }
        product.variant[index] = {
            ...product.variant[index],
            ...variantData,
        };
        await product.save();
        return res.status(200).json({
            message: 'Variant updated successfully',
            product,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// API xóa variant
router.delete('/:id/:variantIndex', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id, variantIndex } = req.params;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(404).json({ message: 'Variant not found' });
        }
        product.variant.splice(index, 1);
        await product.save();
        return res.status(200).json({
            message: 'Variant deleted successfully',
            product,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Lấy đánh giá của một sản phẩm
router.get('/:_id/review', async (req, res) => {
    try {
      const product = await Product.findById(req.params._id).select('reviews');
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.json(product.reviews);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching reviews', error });
    }
  });

// Thêm review
router.post('/:_id/review/create', authenticateUser, async (req, res) => {
    try {
        const email = req.user.email;
        const { comment, rating } = req.body;
        const productId = req.params._id;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Tạo review với _id
        const newReview = {
            _id: new mongoose.Types.ObjectId(), // Tạo _id tự động
            email,
            comment,
            rating,
        };

        // Cập nhật thông tin sản phẩm
        product.reviews.push(newReview);
        product.reviewCount = product.reviews.length;
        product.totalRating += rating;
        product.averageReviews = product.totalRating / product.reviewCount;

        await product.save();

        // Trả về review mới
        res.status(201).json({ message: 'Review added successfully', review: newReview });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Sửa review
router.put('/:_id/review/:reviewId', authenticateUser, async (req, res) => {
    try {
        const { comment, rating } = req.body;
        const { _id: productId, reviewId } = req.params;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const review = product.reviews.id(reviewId);
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Update the review
        if (comment) review.comment = comment;
        if (rating) {
            product.totalRating = product.totalRating - review.rating + rating;
            review.rating = rating;
            product.averageReviews = product.totalRating / product.reviews.length;
        }

        await product.save();

        res.status(200).json({ message: 'Review updated successfully', review });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Xóa review
router.delete('/:_id/review/:reviewId', authenticateUser, async (req, res) => {
    try {
        const { _id: productId, reviewId } = req.params;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const review = product.reviews.id(reviewId);
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Remove the review
        product.totalRating -= review.rating;
        product.reviews.pull(reviewId);
        product.reviewCount = product.reviews.length;
        product.averageReviews = product.reviewCount > 0 ? product.totalRating / product.reviewCount : 0;

        await product.save();

        res.status(200).json({ message: 'Review deleted successfully', product });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// API thay đổi earn và cập nhật price (làm tròn lên hàng nghìn)
router.put('/:id/:variantIndex/update-earn', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id, variantIndex } = req.params;
    const { earn } = req.body;

    try {
        if (typeof earn !== 'number' || isNaN(earn) || earn < 0) {
            return res.status(400).json({ message: 'Earn phải là một số không âm' });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(400).json({ message: 'Invalid variant index' });
        }

        const variant = product.variant[index];
        const importPriceStr = variant.importPrice || "0";
        const importPriceNum = parseFloat(importPriceStr.replace(/\./g, '').replace(',', '.')) || 0;

        if (importPriceNum < 0) {
            return res.status(400).json({ message: 'ImportPrice không hợp lệ để tính toán price' });
        }

        variant.earn = earn;
        const rawPrice = importPriceNum * (1 + variant.earn / 100);
        const roundedPrice = Math.ceil(rawPrice / 1000) * 1000;
        variant.price = roundedPrice.toString();
        await product.save();
        return res.status(200).json({
            message: 'Earn and price updated successfully',
            variant: {
                ...variant.toJSON(),
                price: variant.price,
                earn: variant.earn,
                importPrice: variant.importPrice
            }
        });
    } catch (error) {
        console.error('Error updating earn and price:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.put('/:id/:variantIndex/update-import-price', [authenticateAdmin, checkPermission('update_product')], async (req, res) => {
    const { id, variantIndex } = req.params;
    const { importPrice } = req.body;

    try {
        // Kiểm tra dữ liệu đầu vào
        if (!importPrice || isNaN(importPrice.replace(/\./g, ''))) {
            return res.status(400).json({ message: 'ImportPrice phải là một chuỗi số hợp lệ' });
        }

        // Tìm sản phẩm theo ID
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Chuyển variantIndex thành số và kiểm tra hợp lệ
        const index = parseInt(variantIndex, 10);
        if (isNaN(index) || index < 0 || index >= product.variant.length) {
            return res.status(400).json({ message: 'Invalid variant index' });
        }

        // Lấy variant cần cập nhật
        const variant = product.variant[index];

        // Lưu importPrice dưới dạng chuỗi thô
        variant.importPrice = importPrice;

        // Chuyển importPrice từ String sang Number để tính toán
        const importPriceNum = parseFloat(importPrice.replace(/\./g, '').replace(',', '.')) || 0;
        if (importPriceNum < 0) {
            return res.status(400).json({ message: 'ImportPrice không hợp lệ để tính toán price' });
        }

        // Tính lại price dựa trên importPrice mới và earn hiện tại
        const rawPrice = importPriceNum * (1 + (variant.earn || 0) / 100);
        const roundedPrice = Math.ceil(rawPrice / 1000) * 1000;
        variant.price = roundedPrice.toString(); // Lưu dưới dạng chuỗi thô

        // Lưu thay đổi vào database
        await product.save();

        return res.status(200).json({
            message: 'Import price and price updated successfully',
            variant: {
                ...variant.toJSON(),
                price: variant.price,
                earn: variant.earn,
                importPrice: variant.importPrice
            }
        });
    } catch (error) {
        console.error('Error updating import price:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// API lấy danh sách _id dựa trên mảng product.code
router.post('/by-codes', async (req, res) => {
    try {
        const { codes } = req.body;

        // Kiểm tra xem codes có phải là mảng và không rỗng
        if (!Array.isArray(codes) || codes.length === 0) {
            return res.status(400).json({ message: 'Vui lòng cung cấp một mảng codes hợp lệ' });
        }

        // Tìm các sản phẩm theo mảng codes
        const products = await Product.find({ code: { $in: codes } }).select('_id code');

        // Tạo danh sách kết quả với _id tương ứng
        const result = products.map(product => ({
            code: product.code,
            _id: product._id
        }));

        // Kiểm tra nếu không tìm thấy sản phẩm nào
        if (result.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm nào với các code được cung cấp' });
        }

        res.json({
            success: 1,
            total: result.length,
            products: result
        });
    } catch (error) {
        console.error('Error fetching products by codes:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Khởi tạo multer memory storage cho việc upload ảnh quét hóa đơn tạm thời
const uploadMemory = multer({ storage: multer.memoryStorage() });

// API quét ảnh hóa đơn bằng AI
router.post('/scan-invoice', [authenticateAdmin, uploadMemory.single('invoice')], async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
            return res.status(400).json({ 
                success: 0, 
                message: 'Vui lòng cấu hình GEMINI_API_KEY hợp lệ trong file be/.env trước khi sử dụng tính năng này.' 
            });
        }

        if (!req.file) {
            return res.status(400).json({ success: 0, message: 'Không có file ảnh được tải lên.' });
        }

        // 1. Lấy toàn bộ sản phẩm hiển thị trong DB để Gemini làm dữ liệu đối khớp
        const activeProducts = await Product.find({ display: true }).select('_id name code brand variant');
        
        // Rút gọn thông tin truyền cho Gemini để tiết kiệm token
        const productContext = activeProducts.map(p => ({
            id: p._id.toString(),
            name: p.name,
            code: p.code || '',
            brand: p.brand || '',
            price: p.variant?.[0]?.price || ''
        }));

        // 2. Chuyển ảnh sang base64
        const base64Image = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;

        // 3. Chuẩn bị prompt hướng dẫn chi tiết cho Gemini
        const systemPrompt = `Bạn là một AI phân tích hình ảnh hóa đơn chuyên nghiệp.
Nhiệm vụ của bạn là đọc hình ảnh hóa đơn được gửi lên và trích xuất danh sách các mặt hàng (sản phẩm), bao gồm các thông tin: số lượng (quantity), đơn giá (price), đơn vị tính (unit), và ghi chú (note).

Đồng thời, bạn được cung cấp danh sách sản phẩm hiện có trong cơ sở dữ liệu (Database) dưới dạng mảng JSON. Với mỗi mặt hàng quét được từ hóa đơn, hãy tìm sản phẩm khớp nhất trong Database dựa trên so khớp tên sản phẩm (name), mã sản phẩm (code) hoặc hãng sản xuất (brand).

Danh sách sản phẩm trong Database:
${JSON.stringify(productContext)}

Hướng dẫn khớp sản phẩm:
- Hãy so sánh tên sản phẩm trên hóa đơn với trường \`name\` và \`code\` trong Database.
- Nếu thấy khớp mờ (fuzzy match) hoặc viết tắt hợp lý, hãy gán trường \`matchedProductId\` là \`id\` của sản phẩm đó trong Database.
- Nếu không tìm thấy sản phẩm nào tương đồng trong Database, hãy đặt \`matchedProductId\` là null.
- Trường \`price\` và \`quantity\` phải là kiểu số nguyên dương (hãy loại bỏ các ký tự dấu chấm, dấu phẩy hoặc đơn vị VND).
- Trường \`unit\` là đơn vị tính đọc được trên hóa đơn (ví dụ: cái, bộ, mét...).

Định dạng phản hồi BẮT BUỘC là một mảng JSON trực tiếp (không nằm trong thẻ markdown \`\`\`json và không có văn bản giải thích đi kèm):
[
  {
    "matchedProductId": "ID của sản phẩm khớp trong Database hoặc null",
    "rawScannedName": "Tên sản phẩm đọc được từ ảnh hóa đơn",
    "code": "Mã sản phẩm đọc được từ ảnh hóa đơn (nếu có)",
    "quantity": 10,
    "price": 150000,
    "unit": "cái",
    "note": "Ghi chú nếu có"
  }
]`;

        // 4. Gọi API Gemini bằng fetch (Sử dụng Gemini 3.5 Flash)
        const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: systemPrompt },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Image
                                }
                            }
                        ]
                    }
                ]
            })
        });

        if (!geminiRes.ok) {
            const errorText = await geminiRes.text();
            throw new Error(`Lỗi từ Gemini API: ${errorText}`);
        }

        const geminiData = await geminiRes.json();
        
        // Lấy text phản hồi và parse sang JSON
        let textResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResult) {
            throw new Error('Không nhận được dữ liệu phân tích từ Gemini.');
        }

        // Đảm bảo không bị bọc bởi markdown block ```json ... ``` hoặc ``` ... ```
        textResult = textResult.trim();
        textResult = textResult.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

        const items = JSON.parse(textResult);

        res.json({
            success: 1,
            total: items.length,
            items: items
        });

    } catch (error) {
        console.error('Lỗi khi quét hóa đơn bằng AI:', error);
        res.status(500).json({ 
            success: 0, 
            message: `Đã xảy ra lỗi khi phân tích hóa đơn bằng AI: ${error.message}`, 
            error: error.message 
        });
    }
});

// Export router
module.exports = {
    Product,
    router,
    uploadImage
};

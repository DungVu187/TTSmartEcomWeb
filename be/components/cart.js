const { User, authenticateUser } = require('./user');
const express = require('express');
const router = express.Router();

router.post('/addToCart', authenticateUser, async (req, res) => {
    const { productId, variantIndex } = req.body;
    
    // Validate & sanitize quantity
    let quantity = 1;
    if (req.body.quantity !== undefined) {
        const parsed = parseInt(req.body.quantity, 10);
        if (!isNaN(parsed) && parsed > 0) {
            quantity = parsed;
        }
    }

    try {
        // Lấy user từ database
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Kiểm tra sản phẩm đã có trong giỏ hàng hay chưa
        const existingCartItem = user.cart.find(
            (item) => item.productId.toString() === productId && item.variantIndex === variantIndex
        );

        if (existingCartItem) {
            existingCartItem.quantity = (existingCartItem.quantity || 1) + quantity;
        } else {
            user.cart.push({ productId, variantIndex, quantity });
        }

        await user.save();
        res.status(200).json({ message: 'Product added to cart successfully', cart: user.cart });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.put('/updateStatus', authenticateUser, async (req, res) => {
    const { productId, variantIndex, status } = req.body;
    try {
        // Validate user existence
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Find the cart item
        const cartItem = user.cart.find(
            (item) => item.productId.toString() === productId && item.variantIndex === variantIndex
        );
        if (!cartItem) {
            return res.status(404).json({ message: 'Cart item not found' });
        }
        // Update the status
        cartItem.status = status;
        await user.save();

        res.status(200).json({ message: 'Cart item status updated successfully', cart: user.cart });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.put('/updateCartItem', authenticateUser, async (req, res) => {
    const { productId, variantIndex, quantity } = req.body;
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        const cartItem = user.cart.find(
            (item) => item.productId.toString() === productId && item.variantIndex === variantIndex
        );
        if (cartItem) {
            cartItem.quantity = Math.max(1, Number(quantity));
        }
        await user.save();
        res.json({ cart: user.cart });
    } catch (error) {
        console.error('Error updating cart item:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/getCart', authenticateUser, async (req, res) => {
    const userId = req.user.userId;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ cart: user.cart });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/removeFromCart', authenticateUser, async (req, res) => {
    const { productId, variantIndex } = req.body;
    try {
        // Validate user existence
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Remove the cart item
        user.cart = user.cart.filter(
            (item) => !(item.productId.toString() === productId && item.variantIndex === variantIndex)
        );
        await user.save();

        res.status(200).json({ message: 'Product removed from cart successfully', cart: user.cart });
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/clearCart', authenticateUser, async (req, res) => {
    try {
        // Validate user existence
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Clear the cart
        user.cart = [];
        await user.save();

        res.status(200).json({ message: 'Cart cleared successfully', cart: user.cart });
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = {
    router
};

import React, { createContext, useState, useEffect } from "react";
import toast from "react-hot-toast";

export const ShopContext = createContext(null);

const ShopContextProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // Hàm gửi yêu cầu API với cookie
  const sendRequest = async (url, method, body = null) => {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : null,
        credentials: "include", // Gửi cookie
      });
      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Bạn cần đăng nhập để thực hiện hành động này");
          setTimeout(() => {
            window.location.href = "/login";
          }, 1000);
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to update cart");
      }
      const data = await response.json();
      setCartItems(data.cart || []);
      return data;
    } catch (error) {
      console.error(`Error with ${url}:`, error);
      if (error.message !== "Unauthorized") {
        toast.error("Đã xảy ra lỗi. Vui lòng thử lại sau.");
      }
      throw error;
    }
  };

  // Lấy giỏ hàng từ server khi load ứng dụng
  useEffect(() => {
    const fetchCart = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACK_END}/carts/getCart`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Gửi cookie
        });
        if (response.ok) {
          const data = await response.json();
          setCartItems(data.cart || []);
        } else if (response.status === 401) {
          setCartItems([]);
          // Không hiển thị lỗi ở đây để tránh thông báo khi chưa đăng nhập
        } else {
          throw new Error("Failed to fetch cart");
        }
      } catch (error) {
        console.error("Error fetching cart from server:", error);
      }
    };
    fetchCart();
  }, []);

  // Thêm sản phẩm vào giỏ hàng
  const addToCart = async (productId, variantIndex) => {
    try {
      await sendRequest(`${process.env.REACT_APP_BACK_END}/carts/addToCart`, "POST", {
        productId,
        variantIndex,
      });
      toast.success("Đã thêm sản phẩm vào giỏ hàng");
    } catch (error) {
      // Lỗi đã được xử lý trong sendRequest
    }
  };

  // Xóa sản phẩm khỏi giỏ hàng
  const removeFromCart = async (productId, variantIndex) => {
    try {
      await sendRequest(`${process.env.REACT_APP_BACK_END}/carts/removeFromCart`, "POST", {
        productId,
        variantIndex,
      });
    } catch (error) {
      // Lỗi đã được xử lý trong sendRequest
    }
  };

  // Cập nhật số lượng sản phẩm trong giỏ hàng
  const updateCartItem = async (productId, variantIndex, quantity) => {
    try {
      await sendRequest(`${process.env.REACT_APP_BACK_END}/carts/updateCartItem`, "PUT", {
        productId,
        variantIndex,
        quantity,
      });
    } catch (error) {
      // Lỗi đã được xử lý trong sendRequest
    }
  };

  // Cập nhật trạng thái của sản phẩm
  const updateCartItemStatus = async (productId, variantIndex, status) => {
    try {
      await sendRequest(`${process.env.REACT_APP_BACK_END}/carts/updateStatus`, "PUT", {
        productId,
        variantIndex,
        status,
      });
      toast.success("Đã cập nhật trạng thái sản phẩm");
    } catch (error) {
      // Lỗi đã được xử lý trong sendRequest
    }
  };

  // Xóa toàn bộ giỏ hàng
  const clearCart = async () => {
    try {
      await sendRequest(`${process.env.REACT_APP_BACK_END}/carts/clearCart`, "POST");
      toast.success("Đã xóa toàn bộ giỏ hàng");
    } catch (error) {
      // Lỗi đã được xử lý trong sendRequest
    }
  };

  const getCartItemCount = () => cartItems.length;

  return (
    <ShopContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateCartItem,
        updateCartItemStatus,
        getCartItemCount,
        clearCart,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export default ShopContextProvider;
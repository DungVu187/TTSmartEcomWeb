import React, { useState, useEffect } from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Collapse,
  useMediaQuery,
  IconButton,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import {
  ExpandLess,
  ExpandMore,
  Logout as LogoutIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";
import {
  Inventory as ProductIcon,
  Style as ChipIcon,
  ShoppingCart as OrderIcon,
  ListAlt as OrderListIcon,
  Sell as SoldIcon,
  Settings as ManageIcon,
  DisplaySettings as DisplayIcon,
  Chat as ChatIcon
} from "@mui/icons-material";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import PersonIcon from "@mui/icons-material/Person";
import CabinIcon from "@mui/icons-material/Cabin";
import TocIcon from '@mui/icons-material/Toc';
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import toast from "react-hot-toast";
import { useOrderContext } from "../context/ordercontext";
import { io } from "socket.io-client";

const apiUrl = import.meta.env.VITE_API_URL;
const socket = io(apiUrl, { withCredentials: true });

const drawerWidth = 240;

const Sidebar = () => {
  const isMobile = useMediaQuery("(max-width:900px)");
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleItemClick = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const { orderChanged } = useOrderContext();
  const navigate = useNavigate();
  const [openItems, setOpenItems] = useState({});
  const [processingCount, setProcessingCount] = useState(0);
  const [userFunctions, setUserFunctions] = useState([]);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const res = await fetch(`${apiUrl}/users/profile`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) {
          setUserFunctions(data.functions || []);
          setUserRole(data.role || "");
          setUserName(data.name || "");
          setUserPhone(data.phone || "");
        }
      } catch (err) {
        console.error("Lỗi khi lấy thông tin người dùng:", err);
      }
    };
    fetchUserProfile();
  }, []);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch(`${apiUrl}/orders/processing-count`, {
          credentials: "include",
        });
        const data = await response.json();
        if (data.success) {
          setProcessingCount(data.count);
        }
      } catch (error) {
        console.error("Lỗi lấy số lượng đơn đang xử lý:", error);
      }
    };
    fetchCount();
  }, [orderChanged]);

  useEffect(() => {
    const updateCount = async () => {
      try {
        const response = await fetch(`${apiUrl}/orders/processing-count`, {
          credentials: "include",
        });
        const data = await response.json();
        if (data.success) {
          setProcessingCount(data.count);
        }
      } catch (error) {
        console.error("Lỗi khi cập nhật số lượng đơn hàng:", error);
      }
    };

    // Lắng nghe các sự kiện socket
    socket.on("order_created", updateCount);
    socket.on("order_updated", updateCount);
    socket.on("order_cancelled", updateCount);
    socket.on("order_deleted", updateCount);

    return () => {
      socket.off("order_created", updateCount);
      socket.off("order_updated", updateCount);
      socket.off("order_cancelled", updateCount);
      socket.off("order_deleted", updateCount);
    };
  }, []);

  const handleClick = (index) => {
    setOpenItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleLogout = async () => {
    try {
      const response = await fetch(`${apiUrl}/users/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        document.cookie =
          "authToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        toast.success("Đăng xuất thành công!");
        navigate("/login");
      } else {
        toast.error("Không thể đăng xuất. Vui lòng thử lại!");
      }
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Đã xảy ra lỗi khi đăng xuất!");
    }
  };

  const canView = (func) => userRole === "admin" || userFunctions.includes(func);

  const menuItems = [
    { text: "Sản phẩm", path: "/product", icon: <ProductIcon /> },
    { text: "Chips", path: "/chip", icon: <ChipIcon /> },
    canView("order_management") && {
      text: "Đơn bán hàng",
      icon: (
        <div style={{ position: "relative" }}>
          <OrderIcon />
          {processingCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                backgroundColor: "red",
                color: "white",
                borderRadius: "50%",
                padding: "2px 6px",
                fontSize: "10px",
                fontWeight: "bold",
                lineHeight: 1,
              }}
            >
              {processingCount}
            </span>
          )}
        </div>
      ),
      subItems: [
        { text: "Đơn hàng bán", path: "/order", icon: <OrderListIcon /> },
        { text: "Sản phẩm bán", path: "/soldproducts", icon: <SoldIcon /> },
      ],
    },
    canView("iporder_management") && {
      text: "Đơn nhập hàng",
      icon: <AddShoppingCartIcon />,
      subItems: [
        { text: "Đơn hàng nhập", path: "/importorder", icon: <OrderListIcon /> },
        { text: "Sản phẩm nhập", path: "/orderedproducts", icon: <SoldIcon /> },
      ],
    },
    canView("eporder_management") && {
      text: "Đơn xuất hàng",
      icon: <ShoppingCartCheckoutIcon />,
      subItems: [
        { text: "Đơn hàng xuất", path: "/exportorder", icon: <OrderListIcon /> },
        { text: "Sản phẩm xuất", path: "/exportedproducts", icon: <SoldIcon /> },
      ],
    },
    {
      text: "Khách - Trạm",
      icon: <ManageIcon />,
      subItems: [
        { text: "Trạm", path: "/station", icon: <CabinIcon /> },
        { text: "Khách hàng", path: "/stationuser", icon: <PersonIcon /> },
      ],
    },
    { text: "Quản lý banner", path: "/manage", icon: <ManageIcon /> },
    { text: "Hiển thị sản phẩm", path: "/sectiondisplay", icon: <DisplayIcon /> },
    userRole === "admin" && {
      text: "Phân quyền",
      path: "/account",
      icon: <PersonIcon />,
    },
    userRole === "admin" && {
      text: "Cấu hình Zalo",
      path: "/zalo",
      icon: <ManageIcon />,
    },
    { text: "Lịch sử", path: "/history", icon: <TocIcon /> },
    { text: "Chat hỗ trợ", path: "/chat", icon: <ChatIcon /> },
    { text: "Đăng xuất", icon: <LogoutIcon />, action: "logout" },
  ].filter(Boolean);

  const drawerContent = (
    <>
      <Toolbar sx={{ display: "flex", flexDirection: "column", justifyContent: "center", py: 1.5 }}>
        <Typography
          variant="h6"
          sx={{ color: "white", width: "100%", textAlign: "center", fontWeight: "bold" }}
        >
          Điều hướng
        </Typography>
        {(userName || userPhone) && (
          <Typography
            variant="body2"
            sx={{ color: "#b0bec5", width: "100%", textAlign: "center", mt: 0.5 }}
          >
            Xin chào, {userName || userPhone}
          </Typography>
        )}
      </Toolbar>
      <List>
        {menuItems.map((item, index) => (
          <React.Fragment key={index}>
            <ListItem disablePadding>
              {item.path ? (
                <ListItemButton
                  component={Link}
                  to={item.path}
                  onClick={handleItemClick}
                  sx={{
                    justifyContent: "center",
                    color: "white",
                    "&:hover": { backgroundColor: "#333333" },
                  }}
                >
                  <ListItemIcon sx={{ color: "white", minWidth: "40px" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              ) : item.action === "logout" ? (
                <ListItemButton
                  onClick={() => {
                    handleLogout();
                    handleItemClick();
                  }}
                  sx={{
                    justifyContent: "center",
                    color: "white",
                    "&:hover": { backgroundColor: "#333333" },
                  }}
                >
                  <ListItemIcon sx={{ color: "white", minWidth: "40px" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              ) : (
                <ListItemButton
                  onClick={() => handleClick(index)}
                  sx={{
                    justifyContent: "center",
                    color: "white",
                    "&:hover": { backgroundColor: "#333333" },
                  }}
                >
                  <ListItemIcon sx={{ color: "white", minWidth: "40px" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                  {openItems[index] ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
              )}
            </ListItem>
            {item.subItems && (
              <Collapse in={openItems[index]} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {item.subItems.map((subItem, subIndex) => (
                    <ListItem key={subIndex} disablePadding sx={{ pl: 3 }}>
                      <ListItemButton
                        component={Link}
                        to={subItem.path}
                        onClick={handleItemClick}
                        sx={{
                          justifyContent: "center",
                          color: "white",
                          "&:hover": { backgroundColor: "#333333" },
                        }}
                      >
                        <ListItemIcon sx={{ color: "white", minWidth: "40px" }}>
                          {subItem.icon}
                        </ListItemIcon>
                        <ListItemText primary={subItem.text} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            )}
          </React.Fragment>
        ))}
      </List>
    </>
  );

  return (
    <>
      {isMobile && (
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={handleDrawerToggle}
          sx={{
            position: "fixed",
            left: 16,
            top: 16,
            zIndex: 1100,
            backgroundColor: "#212121",
            color: "white",
            "&:hover": {
              backgroundColor: "#333333",
            },
          }}
        >
          <MenuIcon />
        </IconButton>
      )}
      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? mobileOpen : true}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          width: isMobile ? 0 : drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: "#212121",
            color: "#fff",
            "&::-webkit-scrollbar": {
              display: "none",
            },
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          },
        }}
        anchor="left"
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default Sidebar;

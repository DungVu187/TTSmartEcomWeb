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
  ShoppingCart as OrderIcon,
  ListAlt as OrderListIcon,
  Sell as SoldIcon,
  Settings as ManageIcon,
  DisplaySettings as DisplayIcon,
} from "@mui/icons-material";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import PersonIcon from "@mui/icons-material/Person";
import CabinIcon from "@mui/icons-material/Cabin";
import TocIcon from '@mui/icons-material/Toc';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import toast from "react-hot-toast";
import { useOrderContext } from "../context/ordercontext";
import { usePermissions } from "../context/permissioncontext";
import { io } from "socket.io-client";

const apiUrl = import.meta.env.VITE_API_URL;

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

  const {
    profile,
    isAdminOrSuperadmin,
    can,
  } = usePermissions();

  const userName = profile?.name || "";
  const userPhone = profile?.phone || "";

  const canViewOrders = can("order.view");

  useEffect(() => {
    if (!canViewOrders) {
      setProcessingCount(0);
      return;
    }

    const fetchCount = async () => {
      try {
        const response = await fetch(`${apiUrl}/orders/processing-count`, {
          credentials: "include",
        });
        const data = await response.json();
        if (data.success) {
          setProcessingCount(data.count);
        }
      } catch {
        // Silently ignore fetch errors for badge count
      }
    };
    fetchCount();
  }, [orderChanged, canViewOrders]);

  useEffect(() => {
    if (!canViewOrders) return;

    let socketUrl = apiUrl;
    let socketOptions = {
      withCredentials: true,
      transports: ["websocket", "polling"],
    };

    try {
      const parsedUrl = new URL(apiUrl, window.location.origin);
      if (parsedUrl.pathname && parsedUrl.pathname !== "/") {
        socketUrl = parsedUrl.origin;
        socketOptions.path = parsedUrl.pathname.replace(/\/$/, "") + "/socket.io";
      }
    } catch {
      // Silently ignore URL parse errors for socket
    }

    const socketInstance = io(socketUrl, socketOptions);

    const updateCount = async () => {
      try {
        const response = await fetch(`${apiUrl}/orders/processing-count`, {
          credentials: "include",
        });
        const data = await response.json();
        if (data.success) {
          setProcessingCount(data.count);
        }
      } catch {
        // Silently ignore fetch errors for badge count
      }
    };

    socketInstance.on("order_created", updateCount);
    socketInstance.on("order_updated", updateCount);
    socketInstance.on("order_cancelled", updateCount);
    socketInstance.on("order_deleted", updateCount);

    return () => {
      socketInstance.off("order_created", updateCount);
      socketInstance.off("order_updated", updateCount);
      socketInstance.off("order_cancelled", updateCount);
      socketInstance.off("order_deleted", updateCount);
      socketInstance.disconnect();
    };
  }, [canViewOrders]);

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
    } catch {
      toast.error("Đã xảy ra lỗi khi đăng xuất!");
    }
  };

  const stationSubItems = [
    can("station.view") && { text: "Trạm", path: "/station", icon: <CabinIcon /> },
    can("customer.view") && { text: "Khách hàng", path: "/stationuser", icon: <PersonIcon /> },
  ].filter(Boolean);

  const menuItems = [
    can("product.view") && { text: "Sản phẩm", path: "/product", icon: <ProductIcon /> },
    canViewOrders && {
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
        {
          text: "Đơn hàng bán",
          path: "/order",
          icon: (
            <div style={{ position: "relative" }}>
              <OrderListIcon />
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
        },
        { text: "Sản phẩm bán", path: "/soldproducts", icon: <SoldIcon /> },
      ],
    },
    can("iporder.view") && {
      text: "Đơn nhập hàng",
      icon: <AddShoppingCartIcon />,
      subItems: [
        { text: "Đơn hàng nhập", path: "/importorder", icon: <OrderListIcon /> },
        { text: "Sản phẩm nhập", path: "/orderedproducts", icon: <SoldIcon /> },
      ],
    },
    can("eporder.view") && {
      text: "Đơn xuất hàng",
      icon: <ShoppingCartCheckoutIcon />,
      subItems: [
        { text: "Đơn hàng xuất", path: "/exportorder", icon: <OrderListIcon /> },
        { text: "Sản phẩm xuất", path: "/exportedproducts", icon: <SoldIcon /> },
      ],
    },
    stationSubItems.length > 0 && {
      text: "Khách - Trạm",
      icon: <ManageIcon />,
      subItems: stationSubItems,
    },
    can("storefront.manage") && { text: "Quản lý banner", path: "/manage", icon: <ManageIcon /> },
    can("storefront.manage") && { text: "Hiển thị sản phẩm", path: "/sectiondisplay", icon: <DisplayIcon /> },
    isAdminOrSuperadmin && {
      text: "Phân quyền",
      path: "/account",
      icon: <PersonIcon />,
    },
    isAdminOrSuperadmin && {
      text: "Cấu hình tự động",
      icon: <ManageIcon />,
      subItems: [
        { text: "Zalo OA", path: "/zalo", icon: <ManageIcon /> },
        { text: "Telegram", path: "/telegram", icon: <ManageIcon /> },
      ],
    },
    can("voice.manage") && {
      text: "Từ vựng Voice",
      path: "/voice-vocab",
      icon: <RecordVoiceOverIcon />,
    },
    (can("history_import.view") || can("history_export.view")) && {
      text: "Lịch sử kho",
      icon: <TocIcon />,
      subItems: [
        can("history_import.view") && {
          text: "Lịch sử nhập kho",
          path: "/history/import",
          icon: <OrderListIcon />,
        },
        can("history_export.view") && {
          text: "Lịch sử xuất kho",
          path: "/history/export",
          icon: <ShoppingCartCheckoutIcon />,
        },
      ].filter(Boolean),
    },
    can("activitylog.view") && { text: "Lịch sử hoạt động", path: "/activity-log", icon: <HistoryEduIcon /> },
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
                  <ListItemIcon sx={{ color: "white", minWidth: "35px" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontSize: "15px", fontWeight: 500 }}
                  />
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
                  <ListItemIcon sx={{ color: "white", minWidth: "35px" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontSize: "15px", fontWeight: 500 }}
                  />
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
                  <ListItemIcon sx={{ color: "white", minWidth: "35px" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontSize: "15px", fontWeight: 500 }}
                  />
                  {openItems[index] ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
              )}
            </ListItem>
            {item.subItems && (
              <Collapse in={openItems[index]} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {item.subItems.map((subItem, subIndex) => (
                    <ListItem key={subIndex} disablePadding sx={{ pl: 2 }}>
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
                        <ListItemIcon sx={{ color: "white", minWidth: "35px" }}>
                          {subItem.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={subItem.text}
                          primaryTypographyProps={{ fontSize: "14px" }}
                        />
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

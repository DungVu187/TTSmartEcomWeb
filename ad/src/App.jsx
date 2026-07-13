import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './layout/sidebar';
import Products from './components/products';
import Chips from './components/chips';
import ProductDisplay from './components/productdisplay';
import Orders from './components/orders';
import SalesOrderDetail from './components/order/orderdetail';
import Login from './components/login';
import ProtectedRoute from './components/protectedroute';
import RoleGuard from './components/RoleGuard';
import Manage from './components/manage';
import SectionDisplay from './components/sectiondisplay';
import SoldProducts from './components/soldproducts';
import IpOrders from './components/iporder/iporders';
import ImportOrderDetail from './components/iporder/iporderdetail';
import IpOrderTemplate from './components/iporder/ipordertemplate';
import OrderedProducts from './components/iporder/orderedproducts';
import EpOrders from './components/eporder/eporders';
import ExportOrderDetail from './components/eporder/eporderdetail';
import ExportedProducts from './components/eporder/exportedpeoducts';
import Account from './components/account';
import StationUser from './components/stationuser';
import Station from './components/station';
import StationDisplay from './components/stationdisplay';
import History from './components/history';
import ActivityLog from './components/activitylog';
import ZaloSettings from './components/ZaloSettings';
import TelegramSettings from './components/TelegramSettings';
import VoiceVocab from './components/voicevocab';
import VoiceSearchFAB from './components/VoiceSearchFAB';
import { PermissionProvider } from './context/permissioncontext';

const App = () => {
  return (
    <PermissionProvider>
      <Router basename="/admin">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Box sx={{ display: 'flex', width: "100%", minHeight: "100vh" }}>
                  <Sidebar />
                  <Box className="admin-content-wrapper" sx={{ flex: 1, padding: '20px', pt: { xs: '70px', md: '20px' }, minWidth: 0 }}>
                    <Routes>
                      <Route index element={<Navigate to="/product" replace />} />
                      <Route path="/account" element={<RoleGuard adminOnly><Account /></RoleGuard>} />
                      <Route path="/product" element={<RoleGuard requiredPermission="product.view"><Products /></RoleGuard>} />
                      <Route path="/chip" element={<RoleGuard requiredPermission="product.view"><Chips /></RoleGuard>} />
                      <Route path="/cluster" element={<RoleGuard requiredPermission="product.view"><Chips onlySection={true} /></RoleGuard>} />
                      <Route path="/product/:productId" element={<RoleGuard requiredPermission="product.view"><ProductDisplay /></RoleGuard>} />
                      <Route path="/order" element={<RoleGuard requiredPermission="order.view"><Orders /></RoleGuard>} />
                      <Route path="/salesorder/:id" element={<RoleGuard requiredPermission="order.view"><SalesOrderDetail /></RoleGuard>} />
                      <Route path="/manage" element={<RoleGuard requiredPermission="storefront.manage"><Manage /></RoleGuard>} />
                      <Route path="/sectiondisplay" element={<RoleGuard requiredPermission="storefront.manage"><SectionDisplay /></RoleGuard>} />
                      <Route path="/soldproducts" element={<RoleGuard requiredPermission="order.view"><SoldProducts /></RoleGuard>} />
                      <Route path="/orderedproducts" element={<RoleGuard requiredPermission="iporder.view"><OrderedProducts /></RoleGuard>} />
                      <Route path="/importorder" element={<RoleGuard requiredPermission="iporder.view"><IpOrders /></RoleGuard>} />
                      <Route path="/importorder/:id" element={<RoleGuard requiredPermission="iporder.view"><ImportOrderDetail /></RoleGuard>} />
                      <Route path="/exportedproducts" element={<RoleGuard requiredPermission="eporder.view"><ExportedProducts /></RoleGuard>} />
                      <Route path="/exportorder" element={<RoleGuard requiredPermission="eporder.view"><EpOrders /></RoleGuard>} />
                      <Route path="/exportorder/:id" element={<RoleGuard requiredPermission="eporder.view"><ExportOrderDetail /></RoleGuard>} />
                      <Route path="/importordertemplate/:index" element={<RoleGuard requiredPermission="iporder.view"><IpOrderTemplate /></RoleGuard>} />
                      <Route path="/stationuser" element={<RoleGuard requiredPermission="customer.view"><StationUser /></RoleGuard>} />
                      <Route path="/station" element={<RoleGuard requiredPermission="station.view"><Station /></RoleGuard>} />
                      <Route path="/station/:code" element={<RoleGuard requiredPermission="station.view"><StationDisplay /></RoleGuard>} />
                      <Route path="/history" element={<RoleGuard requiredPermission="history.view"><History /></RoleGuard>} />
                      <Route path="/activity-log" element={<RoleGuard adminOnly><ActivityLog /></RoleGuard>} />
                      <Route path="/zalo" element={<RoleGuard adminOnly><ZaloSettings /></RoleGuard>} />
                      <Route path="/telegram" element={<RoleGuard adminOnly><TelegramSettings /></RoleGuard>} />
                      <Route path="/voice-vocab" element={<RoleGuard requiredPermission="voice.manage"><VoiceVocab /></RoleGuard>} />
                      <Route path="*" element={<Navigate to="/product" replace />} />
                    </Routes>
                  </Box>
                  <VoiceSearchFAB />
                </Box>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </PermissionProvider>
  );
};

export default App;

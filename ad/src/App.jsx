import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './layout/sidebar';
import Products from './components/products';
import Chips from './components/chips';
import ProductDisplay from './components/productdisplay';
import Orders from './components/orders';
import Login from './components/login';
import ProtectedRoute from './components/protectedroute';
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
import Chat from './components/chat';

const App = () => {
  return (
    <Router basename="/admin">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div style={{ display: 'flex', width: "100%" }}>
                <Sidebar />
                <div style={{ flex: 1, padding: '20px' }}>
                  <Routes>
                    <Route path="/account" element={<Account />} />
                    <Route path="/product" element={<Products />} />
                    <Route path="/chip" element={<Chips />} />
                    <Route path="/product/:productId" element={<ProductDisplay />} />
                    <Route path="/order" element={<Orders />} />
                    <Route path="/manage" element={<Manage />} />
                    <Route path="/sectiondisplay" element={<SectionDisplay />} />
                    <Route path="/soldproducts" element={<SoldProducts />} />
                    <Route path="/orderedproducts" element={<OrderedProducts />} />
                    <Route path="/importorder" element={<IpOrders />} />
                    <Route path="/importorder/:id" element={<ImportOrderDetail />} />
                    <Route path="/exportedproducts" element={<ExportedProducts />} />
                    <Route path="/exportorder" element={<EpOrders />} />
                    <Route path="/exportorder/:id" element={<ExportOrderDetail />} />
                    <Route path="/importordertemplate/:index" element={<IpOrderTemplate />} />
                    <Route path="/stationuser" element={<StationUser />} />      
                    <Route path="/station" element={<Station />} />
                    <Route path="/station/:code" element={<StationDisplay />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/chat" element={<Chat />} />
                  </Routes>
                </div>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
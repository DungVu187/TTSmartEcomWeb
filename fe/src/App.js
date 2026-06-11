import './App.css';
import Navbar from './layout/navbar/navbar.jsx';
// import Footer from './layout/footer/footer.jsx';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/dashboard.jsx';
import Product from './pages/product.jsx';
import Cart from './pages/cart.jsx';
import LogIn from './pages/login.jsx';
import { Toaster } from 'react-hot-toast';
import ProductDisplay from './components/productdisplay.jsx';
import ShopContextProvider from './context/shopcontext.jsx';
import MyOrder from './pages/myorder.jsx';
import ScrollRestoration from './components/scrollrestoration.jsx';
import Intro from './pages/intro.jsx';
import Policy from './pages/policy.jsx';
import MainPage from './pages/mainpage.jsx';
import ValueList from './pages/valuelist.jsx';
import AutoLog from './pages/autolog.jsx';
import Station from './pages/station.jsx';
import StationDisplay from './components/stationdisplay.jsx';
import StationDisplayDetail from './components/stationdisplaydetail.jsx';
import ChangePassword from './pages/changepassword.jsx';
import ChatWidget from './components/chatwidget/chatwidget.jsx';

function App() {
  return (
    <ShopContextProvider>
      <BrowserRouter>
        <Navbar />
        <ScrollRestoration>
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/product" element={<Product />} />
            <Route path="/product/:productId" element={<ProductDisplay />} />
            <Route path="/login" element={<LogIn />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/myorder" element={<MyOrder />} />
            <Route path="/introduction" element={<Intro />} />
            <Route path="/policy" element={<Policy />} />
            <Route path="/section/:sectionName" element={<ValueList />} />
            <Route path="/station" element={<Station />} />
            <Route path="/station/:code" element={<StationDisplay />} />
            <Route path="/station/:code/:section" element={<StationDisplayDetail />} />
            <Route path="/:code" element={<AutoLog />} />
            <Route path="/change-password" element={<ChangePassword />} />
          </Routes>
          {/* <Footer /> */}
        </ScrollRestoration>
        <ChatWidget />
        <Toaster position="top-center" />
      </BrowserRouter>
    </ShopContextProvider>
  );
}

export default App;
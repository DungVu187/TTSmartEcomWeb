import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Avatar,
  CircularProgress,
  Box,
  useMediaQuery,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import InfoIcon from '@mui/icons-material/Info';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { ShopContext } from '../context/shopcontext';

const apiUrl = process.env.REACT_APP_BACK_END;

const StationDisplayDetail = () => {
  const { code, section } = useParams();
  const [values, setValues] = useState([]);
  const [productsByValue, setProductsByValue] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { addToCart } = useContext(ShopContext);
  const isSmallScreen = useMediaQuery('(max-width:750px)');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Lấy toàn bộ sản phẩm của trạm
        const resStation = await fetch(`${apiUrl}/stations/code/${code}`);
        if (!resStation.ok) throw new Error("Không tìm thấy trạm");
        const station = await resStation.json();
        const productIds = station.productId || [];

        if (!productIds.length) {
          setLoading(false);
          return;
        }

        const resProducts = await fetch(`${apiUrl}/products/fetch-by-ids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: productIds }),
        });

        const data = await resProducts.json();
        const allProducts = data.products || [];

        // Lọc sản phẩm theo section và phân nhóm theo value
        const filtered = allProducts.filter(
          (p) => p.section === section && p.display !== false
        );

        const grouped = {};
        filtered.forEach((p) => {
          const val = p.value || 'Không xác định';
          if (!grouped[val]) grouped[val] = [];
          grouped[val].push(p);
        });

        setValues(Object.keys(grouped));
        setProductsByValue(grouped);
      } catch (err) {
        console.error('Lỗi khi load dữ liệu:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [code, section]);

  if (loading) {
    return (
      <Box textAlign="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div style={{ backgroundColor: '#ebf6fe', width: '100%', paddingBottom: 16, minHeight: '100vh' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto 50px' }}>
        <Typography
          variant="h4"
          gutterBottom
          style={{
            textAlign: 'center',
            padding: '20px',
            textTransform: 'uppercase',
          }}
        >
          {section}
        </Typography>

        {values.map((value) => {
          const visibleProducts = productsByValue[value];
          if (!visibleProducts || visibleProducts.length === 0) return null;

          return (
            <div key={value} style={{ marginBottom: 48 }}>
              <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ margin: '10px 0 0 20px' }}
                >
                  {value}
                </Typography>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell align="center">Ảnh</TableCell>
                      <TableCell>Tên sản phẩm</TableCell>
                      <TableCell align="right"></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleProducts.map((product) => (
                      <TableRow key={product._id}>
                        <TableCell>
                          <Avatar
                            variant="rounded"
                            src={product.variant?.[0]?.imgUrl}
                            alt={product.name}
                            sx={{
                              width: 56,
                              height: 56,
                              objectFit: 'contain',
                              margin: 'auto',
                            }}
                          />
                        </TableCell>
                        <TableCell>{product.name}</TableCell>
                        <TableCell align="right">
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: { xs: 'column', sm: 'row' },
                              gap: 1,
                              justifyContent: 'flex-end',
                            }}
                          >
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              href="tel:+8413158383"
                              sx={{
                                minWidth: '40px',
                                padding: '6px 12px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              {isSmallScreen ? <PhoneIcon /> : 'Gọi mua hàng'}
                            </Button>
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              onClick={() => addToCart(product._id, 0)}
                              sx={{
                                minWidth: '40px',
                                padding: '6px 12px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              {isSmallScreen ? (
                                <ShoppingCartIcon />
                              ) : (
                                'Thêm vào giỏ'
                              )}
                            </Button>
                            <Button
                              variant="outlined"
                              color="primary"
                              size="small"
                              onClick={() => navigate(`/product/${product._id}`)}
                              sx={{
                                minWidth: '40px',
                                padding: '6px 12px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              {isSmallScreen ? <InfoIcon /> : 'Chi tiết'}
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StationDisplayDetail;

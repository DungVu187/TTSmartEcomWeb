import { useState, useEffect, useRef } from "react";
import { styled } from "@mui/material/styles";
import {
  Button,
  Box,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { Navigation, Pagination, Thumbs } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/thumbs";
import toast from "react-hot-toast";
import HomeCategoryManager from "./homecategorymanager";
import "./style/manage.css";

const apiUrl = import.meta.env.VITE_API_URL;

const IOSSwitch = styled((props) => (
  <Switch focusVisibleClassName=".Mui-focusVisible" disableRipple {...props} />
))(({ theme }) => ({
  width: 42,
  height: 26,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    padding: 0,
    margin: 2,
    transitionDuration: '300ms',
    '&.Mui-checked': {
      transform: 'translateX(16px)',
      color: '#fff',
      '& + .MuiSwitch-track': {
        backgroundColor: '#22c55e', // iOS green
        opacity: 1,
        border: 0,
      },
      '&.Mui-disabled + .MuiSwitch-track': {
        opacity: 0.5,
      },
    },
    '&.Mui-focusVisible .MuiSwitch-thumb': {
      color: '#33cf4d',
      border: '6px solid #fff',
    },
    '&.Mui-disabled .MuiSwitch-thumb': {
      color: theme.palette.grey[100],
    },
    '&.Mui-disabled + .MuiSwitch-track': {
      opacity: 0.7,
    },
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 22,
    height: 22,
  },
  '& .MuiSwitch-track': {
    borderRadius: 26 / 2,
    backgroundColor: '#E9E9EA',
    opacity: 1,
    transition: theme.transitions.create(['background-color', 'border'], {
      duration: 500,
    }),
  },
}));

const ImageCarouselSection = ({
  title,
  emptyText,
  images,
  type,
  thumbsSwiper,
  setThumbsSwiper,
  inputRef,
  onFileSelect,
  onTriggerFileInput,
  onImageClick,
  loading,
  buttonText,
  loadingText,
  mainHeight,
  mainObjectFit,
  slideAltPrefix,
}) => (
  <Box sx={{ mb: 4, width: "900px" }}>
    <Typography variant="h6">{title}</Typography>
    <Box sx={{ border: "1px solid #ccc", padding: 2 }}>
      {images.length > 0 ? (
        <>
          <Swiper
            key={images.join("-")}
            modules={[Navigation, Pagination, Thumbs]}
            navigation
            pagination={{ clickable: true }}
            thumbs={{
              swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null,
            }}
            spaceBetween={10}
            slidesPerView={1}
            style={{ height: mainHeight }}
          >
            {images.map((imgUrl, index) => (
              <SwiperSlide key={index}>
                <Box
                  sx={{ cursor: "pointer" }}
                  onClick={() => onImageClick(imgUrl, type)}
                >
                  <img
                    src={imgUrl}
                    alt={`${slideAltPrefix} ${index}`}
                    style={{ width: "100%", height: mainHeight, objectFit: mainObjectFit }}
                  />
                </Box>
              </SwiperSlide>
            ))}
          </Swiper>
          <Swiper
            onSwiper={setThumbsSwiper}
            modules={[Thumbs]}
            spaceBetween={10}
            slidesPerView={4}
            freeMode
            watchSlidesProgress
            style={{ marginTop: 10 }}
          >
            {images.map((imgUrl, index) => (
              <SwiperSlide key={index}>
                <Box sx={{ cursor: "pointer" }}>
                  <img
                    src={imgUrl}
                    alt={`Thumb ${index}`}
                    style={{ width: "100%", height: 60, objectFit: "cover" }}
                  />
                </Box>
              </SwiperSlide>
            ))}
          </Swiper>
        </>
      ) : (
        <Typography>{emptyText}</Typography>
      )}
    </Box>
    <input
      type="file"
      multiple
      ref={inputRef}
      onChange={onFileSelect(type)}
      accept="image/*"
      style={{ display: "none" }}
    />
    <Button
      variant="contained"
      onClick={onTriggerFileInput(type)}
      disabled={loading}
      sx={{ mt: 2 }}
    >
      {loading ? loadingText : buttonText}
    </Button>
  </Box>
);

const TextUpdateSection = ({
  title,
  buttonLoadingText,
  buttonText,
  label,
  value,
  onChange,
  onUpdate,
  loading,
}) => (
  <Box sx={{ mb: 4, display: "grid" }}>
    <Typography variant="h6">{title}</Typography>
    <Button
      variant="contained"
      onClick={onUpdate}
      disabled={loading}
      sx={{ mb: 2, width: "150px" }}
    >
      {loading ? buttonLoadingText : buttonText}
    </Button>
    <TextField
      multiline
      minRows={5}
      label={label}
      value={value}
      onChange={onChange}
      style={{ minWidth: "500px", borderRadius: "4px", borderColor: "#ccc" }}
    />
  </Box>
);

const Manage = () => {
  const [manageData, setManageData] = useState({
    overViewImg: [],
    partners: [],
    displayPartners: true,
    topPurchaseUrl: "",
    highestRatingUrl: "",
    introduction: "",
    introductionTranslations: { vi: "", zh: "", en: "" },
    homeCategoryConfig: {
      configured: false,
      sidebarTitle: "Danh mục sản phẩm",
      showSidebar: true,
      showQuickCategories: true,
      items: [],
    },
  });
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [bannerThumbsSwiper, setBannerThumbsSwiper] = useState(null);
  const [introductionInputs, setIntroductionInputs] = useState({ vi: "", zh: "", en: "" });
  const [introductionLanguage, setIntroductionLanguage] = useState("vi");
  const [newPartnerName, setNewPartnerName] = useState("");

  const bannerInputRef = useRef(null);
  const topPurchaseInputRef = useRef(null);
  const highestRatingInputRef = useRef(null);

  useEffect(() => {
    fetchManageData();
  }, []);

  const fetchManageData = async () => {
    try {
      const response = await fetch(`${apiUrl}/manages/`, {
        credentials: "include",
      });
      const result = await response.json();
      if (result.success) {
        setManageData(result.data);
        setIntroductionInputs({
          vi: result.data.introductionTranslations?.vi || result.data.introduction || "",
          zh: result.data.introductionTranslations?.zh || result.data.introduction || "",
          en: result.data.introductionTranslations?.en || result.data.introduction || "",
        });
      } else {
        toast.error(result.message || "Lỗi khi lấy dữ liệu");
      }
    } catch (error) {
      console.error("Error fetching manage data:", error);
      toast.error("Đã xảy ra lỗi khi lấy dữ liệu");
    }
  };

  const handleAddPartner = async () => {
    if (!newPartnerName.trim()) return;
    setLoading(true);
    try {
      const updatedPartners = [...(manageData.partners || []), newPartnerName.trim()];
      const response = await fetch(`${apiUrl}/manages/update-partners-text`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ partners: updatedPartners }),
      });
      const result = await response.json();
      if (result.success) {
        setManageData((prev) => ({
          ...prev,
          partners: result.data.partners,
        }));
        setNewPartnerName("");
        toast.success("Thêm đối tác thành công");
      } else {
        toast.error(result.message || "Không thể thêm đối tác");
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi thêm đối tác");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePartner = async (partnerToDelete) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đối tác "${partnerToDelete}" không?`)) return;
    setLoading(true);
    try {
      const updatedPartners = (manageData.partners || []).filter((p) => p !== partnerToDelete);
      const response = await fetch(`${apiUrl}/manages/update-partners-text`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ partners: updatedPartners }),
      });
      const result = await response.json();
      if (result.success) {
        setManageData((prev) => ({
          ...prev,
          partners: result.data.partners,
        }));
        toast.success("Xóa đối tác thành công");
      } else {
        toast.error(result.message || "Không thể xóa đối tác");
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi xóa đối tác");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDisplayPartners = async (checked) => {
    try {
      const response = await fetch(`${apiUrl}/manages/update-partners-text`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ displayPartners: checked }),
      });
      const result = await response.json();
      if (result.success) {
        setManageData((prev) => ({
          ...prev,
          displayPartners: result.data.displayPartners,
        }));
        toast.success(checked ? "Đã bật hiển thị đối tác" : "Đã tắt hiển thị đối tác");
      } else {
        toast.error(result.message || "Không thể cập nhật trạng thái hiển thị");
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi cập nhật trạng thái hiển thị");
    }
  };

  const handleUpload = async (type, files) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    const formData = new FormData();
    for (let file of files) {
      formData.append("manage", file);
    }
    if (type === "topPurchase") {
      formData.append("topPurchaseUrl", "true");
    } else if (type === "highestRating") {
      formData.append("highestRatingUrl", "true");
    }
    try {
      const endpoint =
        type === "banner"
          ? `${apiUrl}/manages/update-images`
          : type === "partners"
          ? `${apiUrl}/manages/update-partners`
          : `${apiUrl}/manages/update`;
      const response = await fetch(endpoint, {
        method: type === "banner" || type === "partners" ? "POST" : "PUT",
        credentials: "include",
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        if (type === "banner") {
          setManageData((prev) => ({
            ...prev,
            overViewImg: result.data.overViewImg,
          }));
        } else if (type === "topPurchase") {
          setManageData((prev) => ({
            ...prev,
            topPurchaseUrl: result.data.topPurchaseUrl,
          }));
        } else if (type === "highestRating") {
          setManageData((prev) => ({
            ...prev,
            highestRatingUrl: result.data.highestRatingUrl,
          }));
        } else if (type === "partners") {
          setManageData((prev) => ({
            ...prev,
            partners: result.data.partners,
          }));
        }
        toast.success("Upload thành công");
      } else {
        toast.error(result.message || "Upload thất bại");
      }
    } catch (error) {
      console.error(`Error uploading ${type} image:`, error);
      toast.error("Đã xảy ra lỗi khi upload");
    } finally {
      setLoading(false);
    }
  };

  const triggerFileInput = (type) => () => {
    if (type === "banner") {
      bannerInputRef.current.click();
    } else if (type === "topPurchase") {
      topPurchaseInputRef.current.click();
    } else if (type === "highestRating") {
      highestRatingInputRef.current.click();
    } else if (type === "partners") {
      partnersInputRef.current.click();
    }
  };

  const handleFileSelect = (type) => (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      handleUpload(type, files);
      event.target.value = "";
    }
  };

  const handleImageClick = (imgUrl, type) => {
    setSelectedImage({ url: imgUrl, type });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedImage(null);
  };

  const handleDeleteImage = async (imgUrl, type) => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/manages/delete-image`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ imgUrl }),
      });
      const result = await response.json();
      if (result.success) {
        if (type === "banner") {
          setManageData((prev) => ({
            ...prev,
            overViewImg: result.data.overViewImg,
          }));
          handleCloseDialog();
        } else if (type === "partners") {
          setManageData((prev) => ({
            ...prev,
            partners: result.data.partners,
          }));
          handleCloseDialog();
        } else if (type === "topPurchase") {
          setManageData((prev) => ({ ...prev, topPurchaseUrl: "" }));
        } else if (type === "highestRating") {
          setManageData((prev) => ({ ...prev, highestRatingUrl: "" }));
        }
        toast.success("Xóa ảnh thành công");
      } else {
        toast.error(result.message || "Xóa ảnh thất bại");
      }
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error("Đã xảy ra lỗi khi xóa ảnh");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateIntroduction = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/manages/update-introduction`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          introduction: introductionInputs.vi,
          translations: introductionInputs,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setManageData((prev) => ({
          ...prev,
          introduction: result.data.introduction,
          introductionTranslations: result.data.introductionTranslations,
        }));
        toast.success("Cập nhật thành công");
      } else {
        toast.error(result.message || "Cập nhật thất bại");
      }
    } catch (error) {
      console.error("Error updating introduction:", error);
      toast.error("Đã xảy ra lỗi khi cập nhật");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ padding: 3 }}>
      <div className="sticky-header">
        <Typography variant="h4" gutterBottom>
          Quản lý nội dung
        </Typography>
      </div>

      <ImageCarouselSection
        title="Ảnh bìa"
        emptyText="Chưa có ảnh bìa"
        images={manageData.overViewImg}
        type="banner"
        thumbsSwiper={bannerThumbsSwiper}
        setThumbsSwiper={setBannerThumbsSwiper}
        inputRef={bannerInputRef}
        onFileSelect={handleFileSelect}
        onTriggerFileInput={triggerFileInput}
        onImageClick={handleImageClick}
        loading={loading}
        buttonText="Thêm ảnh bìa"
        loadingText="Đang tải..."
        mainHeight="300px"
        mainObjectFit="fill"
        slideAltPrefix="Banner"
      />

      <HomeCategoryManager
        value={manageData.homeCategoryConfig}
        onSaved={(updatedManage) => setManageData(updatedManage)}
      />

      <Box sx={{ mb: 4, width: "900px" }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">Tên đối tác (Thương hiệu)</Typography>
          <FormControlLabel
            control={
              <IOSSwitch
                checked={manageData.displayPartners !== false}
                onChange={(e) => handleToggleDisplayPartners(e.target.checked)}
              />
            }
            label={
              <Typography 
                sx={{ 
                  fontWeight: 600, 
                  color: "#475569",
                  fontSize: 14,
                  ml: 1
                }}
              >
                Hiển thị trên trang chủ
              </Typography>
            }
            sx={{ ml: 'auto' }}
          />
        </Box>
        <Box display="flex" gap={2} mb={2}>
          <TextField
            label="Nhập tên đối tác / thương hiệu"
            value={newPartnerName}
            onChange={(e) => setNewPartnerName(e.target.value)}
            variant="outlined"
            size="small"
            fullWidth
            disabled={loading}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddPartner}
            disabled={loading || !newPartnerName.trim()}
            sx={{ minWidth: "150px" }}
          >
            Thêm đối tác
          </Button>
        </Box>
        <TableContainer component={Paper} sx={{ maxWidth: "100%", maxHeight: "300px", overflowY: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Tên đối tác / thương hiệu</TableCell>
                <TableCell align="right" style={{ width: "80px" }}>Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(manageData.partners || []).length > 0 ? (
                (manageData.partners || []).map((partner, index) => (
                  <TableRow key={index}>
                    <TableCell>{partner}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        color="error"
                        onClick={() => handleDeletePartner(partner)}
                        disabled={loading}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} align="center">Chưa có đối tác</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box sx={{ mb: 4, width: "900px" }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Giới thiệu ba ngôn ngữ</Typography>
        <Typography sx={{ color: "#64748b", mb: 2 }}>
          Nội dung này hiển thị tại trang Giới thiệu phía khách hàng theo ngôn ngữ đang chọn.
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          {[
            { key: "vi", label: "Tiếng Việt" },
            { key: "zh", label: "中文简体" },
            { key: "en", label: "English" },
          ].map((language) => (
            <Button
              key={language.key}
              variant={introductionLanguage === language.key ? "contained" : "outlined"}
              onClick={() => setIntroductionLanguage(language.key)}
            >
              {language.label}
            </Button>
          ))}
        </Box>
        <TextUpdateSection
          title=""
          buttonLoadingText="Đang cập nhật..."
          buttonText="Cập nhật cả ba ngôn ngữ"
          label="Nhập nội dung giới thiệu"
          value={introductionInputs[introductionLanguage]}
          onChange={(event) => setIntroductionInputs((current) => ({
            ...current,
            [introductionLanguage]: event.target.value,
          }))}
          onUpdate={handleUpdateIntroduction}
          loading={loading}
        />
      </Box>

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        disableScrollLock
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Xác nhận xóa ảnh</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Bạn có chắc chắn muốn xóa ảnh này khỏi danh sách không?
          </DialogContentText>
          {selectedImage && (
            <img
              src={selectedImage.url}
              alt="Selected"
              style={{ width: "100%", maxHeight: 200, objectFit: "cover", marginTop: 10 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Hủy
          </Button>
          <Button
            onClick={() => handleDeleteImage(selectedImage.url, selectedImage.type)}
            color="error"
            disabled={loading}
            autoFocus
          >
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Manage;

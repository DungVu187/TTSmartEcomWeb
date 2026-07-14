import { useState, useEffect, useRef } from "react";
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
} from "@mui/material";
import { Navigation, Pagination, Thumbs } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/thumbs";
import toast from "react-hot-toast";
import "./style/manage.css";

const apiUrl = import.meta.env.VITE_API_URL;

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
    topPurchaseUrl: "",
    highestRatingUrl: "",
    introduction: "",
    mainPolicy: "",
  });
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [bannerThumbsSwiper, setBannerThumbsSwiper] = useState(null);
  const [partnersThumbsSwiper, setPartnersThumbsSwiper] = useState(null);
  const [introductionInput, setIntroductionInput] = useState("");
  const [mainPolicyInput, setMainPolicyInput] = useState("");

  const bannerInputRef = useRef(null);
  const topPurchaseInputRef = useRef(null);
  const highestRatingInputRef = useRef(null);
  const partnersInputRef = useRef(null);

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
        setIntroductionInput(result.data.introduction || "");
        setMainPolicyInput(result.data.mainPolicy || "");
      } else {
        toast.error(result.message || "Lỗi khi lấy dữ liệu");
      }
    } catch (error) {
      console.error("Error fetching manage data:", error);
      toast.error("Đã xảy ra lỗi khi lấy dữ liệu");
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
        body: JSON.stringify({ introduction: introductionInput }),
      });
      const result = await response.json();
      if (result.success) {
        setManageData((prev) => ({
          ...prev,
          introduction: result.data.introduction,
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

  const handleUpdateMainPolicy = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/manages/update-policy`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ mainPolicy: mainPolicyInput }),
      });
      const result = await response.json();
      if (result.success) {
        setManageData((prev) => ({
          ...prev,
          mainPolicy: result.data.mainPolicy,
        }));
        toast.success("Cập nhật thành công");
      } else {
        toast.error(result.message || "Cập nhật thất bại");
      }
    } catch (error) {
      console.error("Error updating mainPolicy:", error);
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

      <ImageCarouselSection
        title="Ảnh đối tác"
        emptyText="Chưa có đối tác"
        images={manageData.partners}
        type="partners"
        thumbsSwiper={partnersThumbsSwiper}
        setThumbsSwiper={setPartnersThumbsSwiper}
        inputRef={partnersInputRef}
        onFileSelect={handleFileSelect}
        onTriggerFileInput={triggerFileInput}
        onImageClick={handleImageClick}
        loading={loading}
        buttonText="Thêm ảnh đối tác"
        loadingText="Đang tải..."
        mainHeight="100px"
        mainObjectFit="contain"
        slideAltPrefix="Partner"
      />

      <TextUpdateSection
        title="Giới thiệu"
        buttonLoadingText="Đang cập nhật..."
        buttonText="Cập nhật"
        label="Nhập nội dung giới thiệu"
        value={introductionInput}
        onChange={(e) => setIntroductionInput(e.target.value)}
        onUpdate={handleUpdateIntroduction}
        loading={loading}
      />

      <TextUpdateSection
        title="Chính sách"
        buttonLoadingText="Đang cập nhật..."
        buttonText="Cập nhật"
        label="Nhập nội dung chính sách"
        value={mainPolicyInput}
        onChange={(e) => setMainPolicyInput(e.target.value)}
        onUpdate={handleUpdateMainPolicy}
        loading={loading}
      />

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

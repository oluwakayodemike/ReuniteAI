const imageInput = document.getElementById("item-image");
const previewImage = document.getElementById("image-preview");
const cropIcon = document.getElementById("crop-icon");

const cropModal = document.getElementById("crop-modal");
const cropImage = document.getElementById("crop-image");
const cropConfirm = document.getElementById("crop-confirm");
const cropClose = document.getElementById("crop-close");


let uploadedImageDataUrl = null;
let cropper;
let finalImage = null; 

imageInput.addEventListener("change", () => {
  previewImage.innerHTML = "";
  previewImage.appendChild(cropIcon);

  const file = imageInput.files[0];
  if (file && file.type.startsWith("image/")) {
    finalImage = file;
    const reader = new FileReader();
    reader.onload = function (e) {
      uploadedImageDataUrl = e.target.result;
      const img = document.createElement("img");
      img.src = uploadedImageDataUrl;
      img.alt = "uploaded image preview";
      previewImage.appendChild(img);
      cropIcon.style.display = "block";
    };
    reader.readAsDataURL(file);
  } else {
    cropIcon.style.display = "none";
    finalImage = null;
  }
});

cropIcon.addEventListener("click", () => {
  if (!uploadedImageDataUrl) return;
  cropModal.style.display = "flex";
  cropImage.src = uploadedImageDataUrl;
  if (cropper) cropper.destroy();
  cropper = new Cropper(cropImage, {
    aspectRatio: 1,
    viewMode: 1
  });
});

// cropIcon.addEventListener("click", () => {
//   if (!uploadedImageDataUrl) return;
//   cropModal.style.display = "flex";
//   cropImage.src = uploadedImageDataUrl;

//   cropImage.onload = () => {
//     if (cropper) cropper.destroy();
//     cropper = new Cropper(cropImage, {
//       aspectRatio: 1,
//       viewMode: 1,
//       dragMode: "move",
//       autoCropArea: 1,
//       cropBoxResizable: false,
//       cropBoxMovable: true,
//       ready() {
//         const cropBoxData = cropper.getCropBoxData();
//         cropper.setCropBoxData({
//           width: 224,
//           height: 224,
//           left: cropBoxData.left,
//           top: cropBoxData.top,
//         });
//       },
//     });
//   };
// });

cropClose.addEventListener("click", () => {
  cropModal.style.display = "none";
  if (cropper) cropper.destroy();
});

cropConfirm.addEventListener("click", () => {
  if (!cropper) return;
  const canvas = cropper.getCroppedCanvas({ width: 224, height: 224 });

  canvas.toBlob((blob) => {
    finalImage = blob;
    const croppedImg = document.createElement("img");
    croppedImg.src = URL.createObjectURL(blob);

    previewImage.innerHTML = "";
    previewImage.appendChild(cropIcon);
    previewImage.appendChild(croppedImg);
  }, 'image/jpeg');

  cropModal.style.display = "none";
  if (cropper) cropper.destroy();
});
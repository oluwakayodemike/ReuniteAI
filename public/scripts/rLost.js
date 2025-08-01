const imageInput = document.getElementById("item-image");
const previewImage = document.getElementById("image-preview");
const cropIcon = document.getElementById("crop-icon");

const cropModal = document.getElementById("crop-modal");
const cropImage = document.getElementById("crop-image");
const cropConfirm = document.getElementById("crop-confirm");
const cropClose = document.getElementById("crop-close");

const reportForm = document.querySelector('.report-form');
const submitButton = document.querySelector('.submit-button');
const successMessage = document.getElementById('successMessage');

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

// form submission
reportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const status = "lost";
  const formData = new FormData();
  const imageName = imageInput.files[0]?.name || 'item-image.jpg';

  formData.append('itemImage', finalImage, imageName);
  formData.append('description', document.getElementById('item-description').value);
  formData.append('university', document.querySelector('input[name="university"]').value);
  formData.append('customLocation', document.querySelector('input[name="custom-location"]').value);
  formData.append('lat', document.getElementById('lat').value);
  formData.append('lng', document.getElementById('lng').value);
  formData.append('date', document.getElementById('item-date').value);
  formData.append('status', status);

  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';

  try {
    const response = await fetch('http://localhost:3001/api/items/report', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('success:', result);

    reportForm.style.display = 'none';
    successMessage.style.display = 'block';

  } catch (error) {
    console.error('Error:', error);
    alert('failed to submit report, please try again.');
    submitButton.disabled = false;
    submitButton.textContent = 'Submit Lost Item Report';
  }
});
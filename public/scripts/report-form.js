document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('load', async () => {
    const Clerk = window.Clerk;
    try {
        await Clerk.load();
        console.log("Clerk is loaded and ready on the report page.");

        initializeForm();

    } catch (err) {
        console.error("Clerk failed to load on report page", err);
        const submitButton = document.querySelector('.submit-button');
        if(submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Authentication Error';
        }
    }
  });
  const collapsibleToggle = document.querySelector('.collapsible-toggle');
  if (collapsibleToggle) {
      collapsibleToggle.addEventListener('click', function() {
          const collapsible = this.parentElement;
          collapsible.classList.toggle('active');

          const content = this.nextElementSibling;
          if (content.style.maxHeight) {
              content.style.maxHeight = null;
          } else {
              content.style.maxHeight = content.scrollHeight + "px";
          }
      });
  }
});

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
function initializeForm() {
  if (!reportForm) return;

  reportForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const Clerk = window.Clerk;
    if (!Clerk.user) {
        alert("Please log in to report an item.");
        Clerk.openSignIn();
        return;
    }

    const status = reportForm.dataset.status;

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

    if (status === 'found') {
        formData.append('verification_question', document.getElementById('verification-question').value);
        formData.append('verification_answer', document.getElementById('verification-answer').value);
    }
    
    submitButton.disabled = true;
    submitButton.innerHTML = '<div class="loading-spinner"></div>';

    const endpoint = status === 'lost' 
        ? 'https://reuniteai-production.up.railway.app/api/items/search' 
        : 'https://reuniteai-production.up.railway.app/api/items/report';
    try {
      const token = await Clerk.session.getToken();
      if (!token) {
          console.error("Could not verify your session. Please try logging in again.");
          submitButton.disabled = false;
          submitButton.textContent = 'Submit Report';
          return;
      }
      const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${token}`
          },
          body: formData,
      });

      if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('API response:', result);

      if (status === 'lost') {
          sessionStorage.setItem('searchResults', JSON.stringify(result.matches));
          window.location.href = `./search-result.html?lostItemId=${result.lostItemId}`;
      } else {
          reportForm.style.display = 'none';
          successMessage.style.display = 'block';
      }

    } catch (error) {
      console.error('An error occurred inside the submit handler:', error);
      alert('Failed to submit report. Please try again.');
      submitButton.disabled = false;
      submitButton.textContent = 'Submit Report';
    }
  });
}
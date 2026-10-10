// Scotia Fieldsport Log — Cloudinary photo upload

const CloudinaryUpload = (() => {
  async function upload(file, onProgress) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`);
      xhr.upload.onprogress = e => {
        if (onProgress && e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          resolve({ url: res.secure_url, publicId: res.public_id });
        } else {
          reject(new Error('Upload failed: ' + xhr.status));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(fd);
    });
  }

  // Build a photo input widget, returns { el, getUrls }
  function buildPhotoInput(label = 'Add photos') {
    const wrapper = document.createElement('div');
    wrapper.className = 'photo-input-wrapper';
    wrapper.innerHTML = `
      <label class="photo-label">${label}</label>
      <input type="file" accept="image/*" multiple class="photo-file-input" />
      <div class="photo-preview-row"></div>
      <div class="photo-progress"></div>
    `;
    const input = wrapper.querySelector('.photo-file-input');
    const preview = wrapper.querySelector('.photo-preview-row');
    const progress = wrapper.querySelector('.photo-progress');
    const uploadedUrls = [];

    input.addEventListener('change', async () => {
      progress.textContent = 'Uploading…';
      for (const file of Array.from(input.files)) {
        try {
          const res = await upload(file, pct => { progress.textContent = `Uploading ${pct}%…`; });
          uploadedUrls.push(res.url);
          const img = document.createElement('img');
          img.src = res.url;
          img.className = 'photo-thumb';
          preview.appendChild(img);
        } catch (e) {
          progress.textContent = 'Upload error: ' + e.message;
        }
      }
      progress.textContent = uploadedUrls.length ? `${uploadedUrls.length} photo(s) uploaded` : '';
    });

    return { el: wrapper, getUrls: () => uploadedUrls };
  }

  return { upload, buildPhotoInput };
})();

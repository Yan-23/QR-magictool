
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tabId).classList.add('active');
      
      // Stop camera when switching tabs
      if (tabId !== 'scan' && stream) {
        stopCamera();
      }
      
      // Load history when switching to history tab
      if (tabId === 'history') {
        loadHistory();
      }
    });
  });

  // --- Scan Section ---
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const scanOverlay = document.getElementById('scanOverlay');
  const scanResult = document.getElementById('scanResult');
  const scanError = document.getElementById('scanError');
  const resultText = document.getElementById('resultText');
  const errorText = document.getElementById('errorText');
  const startCamBtn = document.getElementById('startCam');
  const stopCamBtn = document.getElementById('stopCam');
  const scanImgBtn = document.getElementById('scanImg');
  const fileInput = document.getElementById('fileInput');
  
  let stream = null;
  let scanTimer = null;
  let lastResult = '';

  // Camera functions
  async function startCamera() {
    try {
      showError(scanError, false);
      showResult(scanResult, false);
      
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      video.srcObject = stream;
      startCamBtn.disabled = true;
      stopCamBtn.disabled = false;
      scanOverlay.classList.remove('hidden');
      
      // Update button state
      startCamBtn.innerHTML = '<span class="loading"></span><span>扫描中...</span>';
      
      scanTimer = setInterval(scanQRCode, 500);
    } catch (err) {
      console.error('摄像头访问失败:', err);
      showError(scanError, '无法访问摄像头: ' + err.message);
      resetCameraButtons();
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    
    if (scanTimer) {
      clearInterval(scanTimer);
      scanTimer = null;
    }
    
    resetCameraButtons();
    scanOverlay.classList.add('hidden');
    video.srcObject = null;
  }

  function resetCameraButtons() {
    startCamBtn.disabled = false;
    stopCamBtn.disabled = true;
    startCamBtn.innerHTML = '<span id="startIcon" class="fas fa-play"></span><span id="startText">开始扫描</span>';
  }

  function scanQRCode() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      
      if (code && code.data !== lastResult) {
        lastResult = code.data;
        showResult(scanResult, code.data);
        addToHistory(code.data, 'scan');
      }
    }
  }

  // Image scanning
  function scanImage() {
    const file = fileInput.files[0];
    if (!file) {
      showError(scanError, '请先选择图片文件');
      return;
    }
    
    showError(scanError, false);
    showResult(scanResult, false);
    
    scanImgBtn.innerHTML = '<span class="loading"></span><span>识别中...</span>';
    scanImgBtn.disabled = true;
    
    const img = new Image();
    img.onload = function() {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, img.width, img.height);
      
      if (code) {
        showResult(scanResult, code.data);
        addToHistory(code.data, 'scan');
      } else {
        showError(scanError, '未识别到二维码，请尝试其他图片');
      }
      
      resetScanImageButton();
    };
    
    img.onerror = function() {
      showError(scanError, '图片加载失败，请重试');
      resetScanImageButton();
    };
    
    img.src = URL.createObjectURL(file);
  }

  function resetScanImageButton() {
    scanImgBtn.innerHTML = '<span id="scanIcon" class="fas fa-search"></span><span>识别图片二维码</span>';
    scanImgBtn.disabled = false;
  }

  function showResult(element, message) {
    if (message) {
      resultText.textContent = message;
      element.classList.remove('hidden');
    } else {
      element.classList.add('hidden');
    }
  }

  function showError(element, message) {
    if (message) {
      errorText.textContent = message;
      element.classList.remove('hidden');
    } else {
      element.classList.add('hidden');
    }
  }

  // Drag and drop for file input
  const fileUploadLabel = document.querySelector('.file-upload-label');
  
  fileUploadLabel.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadLabel.classList.add('dragover');
  });
  
  fileUploadLabel.addEventListener('dragleave', () => {
    fileUploadLabel.classList.remove('dragover');
  });
  
  fileUploadLabel.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadLabel.classList.remove('dragover');
    
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      document.querySelector('.file-upload-label div:first-child').textContent = '已选择: ' + e.dataTransfer.files[0].name;
    }
  });

  // Event listeners for scan section
  startCamBtn.addEventListener('click', startCamera);
  stopCamBtn.addEventListener('click', stopCamera);
  scanImgBtn.addEventListener('click', scanImage);
  
  fileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
      document.querySelector('.file-upload-label div:first-child').textContent = '已选择: ' + this.files[0].name;
    }
  });
  
  // --- Generate Section ---
  const typeSelect = document.getElementById('type');
  const fields = document.getElementById('fields');
  const genBtn = document.getElementById('genBtn');
  const genError = document.getElementById('genError');
  const genErrorText = document.getElementById('genErrorText');
  const qrPreview = document.getElementById('qrPreview');
  const colorOptions = document.querySelectorAll('.color-option');
  
  let currentQRCode = null;
  let selectedColor = '000000';
  let selectedBgColor = 'ffffff';

  // Color picker functionality
  colorOptions.forEach(option => {
    option.addEventListener('click', function() {
      // Remove active class from all options in the same group
      const parent = this.parentElement;
      parent.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.remove('active');
      });
      
      // Add active class to clicked option
      this.classList.add('active');
      
      // Update selected color
      if (this.hasAttribute('data-color')) {
        selectedColor = this.getAttribute('data-color');
      } else if (this.hasAttribute('data-bgcolor')) {
        selectedBgColor = this.getAttribute('data-bgcolor');
      }
    });
  });

  function renderFields() {
    const type = typeSelect.value;
    let html = '';
    
    switch (type) {
      case 'text':
        html = '<label for="val"><i class="fas fa-font"></i> 文本内容</label><textarea id="val" placeholder="输入要编码的文本" rows="4"></textarea>';
        break;
      case 'url':
        html = '<label for="val"><i class="fas fa-link"></i> 网址 URL</label><input id="val" type="url" placeholder="https://example.com" />';
        break;
      case 'tel':
        html = '<label for="val"><i class="fas fa-phone"></i> 电话号码</label><input id="val" type="tel" placeholder="+8613800138000" />';
        break;
      case 'sms':
        html = '<label for="num"><i class="fas fa-sms"></i> 手机号码</label><input id="num" type="tel" placeholder="+8613800138000" />' +
               '<label for="msg"><i class="fas fa-comment"></i> 短信内容</label><textarea id="msg" placeholder="输入短信内容" rows="3"></textarea>';
        break;
      case 'email':
        html = '<label for="mail"><i class="fas fa-envelope"></i> 邮箱地址</label><input id="mail" type="email" placeholder="user@example.com" />' +
               '<label for="sub"><i class="fas fa-tag"></i> 邮件主题</label><input id="sub" placeholder="邮件主题" />' +
               '<label for="msg"><i class="fas fa-comment"></i> 邮件内容</label><textarea id="msg" placeholder="输入邮件内容" rows="3"></textarea>';
        break;
      case 'wifi':
        html = '<label for="ssid"><i class="fas fa-wifi"></i> WiFi 名称 (SSID)</label><input id="ssid" placeholder="WiFi名称" />' +
               '<label for="pwd"><i class="fas fa-key"></i> WiFi 密码</label><input id="pwd" type="password" placeholder="WiFi密码" />' +
               '<label for="enc"><i class="fas fa-shield-alt"></i> 加密方式</label><select id="enc"><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">无密码</option></select>';
        break;
    }
    
    fields.innerHTML = html;
    showError(genError, false);
  }

  function generateQRCode() {
    const type = typeSelect.value;
    let data = '';
    
    // Validate inputs and build data string
    try {
      switch (type) {
        case 'text':
          const text = document.getElementById('val').value.trim();
          if (!text) throw new Error('请输入文本内容');
          data = text;
          break;
        case 'url':
          const url = document.getElementById('val').value.trim();
          if (!url) throw new Error('请输入网址');
          // Add protocol if missing
          data = url.includes('://') ? url : 'https://' + url;
          break;
        case 'tel':
          const tel = document.getElementById('val').value.trim();
          if (!tel) throw new Error('请输入电话号码');
          data = 'tel:' + tel;
          break;
        case 'sms':
          const num = document.getElementById('num').value.trim();
          const smsMsg = document.getElementById('msg').value.trim();
          if (!num) throw new Error('请输入手机号码');
          data = `sms:${num}${smsMsg ? `?body=${encodeURIComponent(smsMsg)}` : ''}`;
          break;
        case 'email':
          const mail = document.getElementById('mail').value.trim();
          const sub = document.getElementById('sub').value.trim();
          const emailMsg = document.getElementById('msg').value.trim();
          if (!mail) throw new Error('请输入邮箱地址');
          data = `mailto:${mail}`;
          if (sub || emailMsg) {
            data += '?';
            if (sub) data += `subject=${encodeURIComponent(sub)}`;
            if (sub && emailMsg) data += '&';
            if (emailMsg) data += `body=${encodeURIComponent(emailMsg)}`;
          }
          break;
        case 'wifi':
          const ssid = document.getElementById('ssid').value.trim();
          const pwd = document.getElementById('pwd').value;
          const enc = document.getElementById('enc').value;
          if (!ssid) throw new Error('请输入WiFi名称');
          if (enc !== 'nopass' && !pwd) throw new Error('请输入WiFi密码');
          data = `WIFI:T:${enc};S:${ssid};P:${pwd};;`;
          break;
      }
      
      // Generate QR code
      currentQRCode = new QRious({
        value: data,
        size: 250,
        background: '#' + selectedBgColor,
        foreground: '#' + selectedColor,
        level: 'H'
      });
      
      // 创建更美观的二维码预览和下载按钮布局
      qrPreview.innerHTML = `
        <div class="qr-container">
          <div class="qr-box pop">
            <img src="${currentQRCode.toDataURL()}" alt="生成的二维码" />
          </div>
          <div class="qr-actions">
            <button id="downloadBtn" class="secondary">
              <span id="downloadIcon" class="fas fa-download"></span>
              <span>下载二维码</span>
            </button>
            <button id="shareBtn" class="secondary">
              <span id="shareIcon" class="fas fa-share-alt"></span>
              <span>分享</span>
            </button>
          </div>
        </div>
      `;
      
      showError(genError, false);
      
      // 添加下载按钮事件监听
      document.getElementById('downloadBtn').addEventListener('click', downloadQRCode);
      document.getElementById('shareBtn').addEventListener('click', shareQRCode);
      
      // Add to history
      addToHistory(data, 'generate');
    } catch (err) {
      showError(genError, err.message);
      qrPreview.innerHTML = '';
    }
  }

  function downloadQRCode() {
    if (!currentQRCode) return;
    
    const link = document.createElement('a');
    link.download = 'qrcode.png';
    link.href = currentQRCode.toDataURL();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function shareQRCode() {
    if (!currentQRCode) return;
    
    // 如果支持Web Share API，使用它
    if (navigator.share) {
      navigator.share({
        title: 'QR码',
        text: '扫描此QR码',
        url: currentQRCode.toDataURL()
      })
      .catch(err => console.log('分享取消或出错:', err));
    } else {
      // 如果不支持Web Share API，复制到剪贴板
      const tempInput = document.createElement('input');
      document.body.appendChild(tempInput);
      tempInput.value = currentQRCode.toDataURL();
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      alert('二维码链接已复制到剪贴板');
    }
  }

  // Initialize and set up event listeners
  renderFields();
  typeSelect.addEventListener('change', renderFields);
  genBtn.addEventListener('click', generateQRCode);
  
  // --- History Section ---
  const clearHistoryBtn = document.getElementById('clearHistory');
  const historyList = document.getElementById('historyList');
  const emptyHistory = document.getElementById('emptyHistory');
  
  function addToHistory(content, type) {
    let history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
    
    // Add new item to beginning of array
    history.unshift({
      content: content,
      type: type,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 20 items
    if (history.length > 20) {
      history = history.slice(0, 20);
    }
    
    localStorage.setItem('qrHistory', JSON.stringify(history));
    
    // If on history tab, update the display
    if (document.getElementById('history').classList.contains('active')) {
      loadHistory();
    }
  }
  
  function loadHistory() {
    const history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
    
    if (history.length === 0) {
      emptyHistory.style.display = 'block';
      historyList.innerHTML = '';
      historyList.appendChild(emptyHistory);
      return;
    }
    
    emptyHistory.style.display = 'none';
    
    let html = '';
    history.forEach((item, index) => {
      const date = new Date(item.timestamp);
      const typeIcon = item.type === 'scan' ? 'fas fa-camera' : 'fas fa-barcode';
      const typeText = item.type === 'scan' ? '扫描' : '生成';
      const shortContent = item.content.length > 50 ? 
        item.content.substring(0, 50) + '...' : item.content;
      
      html += `
        <div class="history-item">
          <div class="history-content">
            <i class="${typeIcon}"></i> ${typeText}: ${shortContent}
            <div style="font-size: 0.8rem; color: var(--text-light); margin-top: 5px;">
              ${date.toLocaleString()}
            </div>
          </div>
          <div class="history-actions">
            <button class="history-btn" onclick="copyToClipboard('${item.content.replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i>
            </button>
            <button class="history-btn" onclick="deleteHistoryItem(${index})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    });
    
    historyList.innerHTML = html;
  }
  
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
      .then(() => {
        // Show success message
        const toast = document.createElement('div');
        toast.textContent = '已复制到剪贴板';
        toast.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: var(--green);
          color: var(--text);
          padding: 10px 20px;
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          z-index: 1000;
          animation: fadeInOut 2s ease;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
          document.body.removeChild(toast);
        }, 2000);
      })
      .catch(err => {
        console.error('复制失败:', err);
      });
  }
  
  function deleteHistoryItem(index) {
    let history = JSON.parse(localStorage.getItem('qrHistory') || '[]');
    history.splice(index, 1);
    localStorage.setItem('qrHistory', JSON.stringify(history));
    loadHistory();
  }
  
  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      localStorage.removeItem('qrHistory');
      loadHistory();
    }
  });
  
  // Add CSS for fadeInOut animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateY(10px); }
      20% { opacity: 1; transform: translateY(0); }
      80% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-10px); }
    }
  `;
  document.head.appendChild(style);});

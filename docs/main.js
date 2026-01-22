// Bordered tile types definition (clockwise order: top → right → bottom → left)
const borderedTileTypes = [
  { id: 'center', name: 'Center', draw: (ctx, s) => { ctx.fillRect(0, 0, s, s); } },
  // Edges (clockwise)
  { id: 'edge_top', name: 'Top Edge', draw: (ctx, s) => { ctx.fillRect(0, s/2, s, s/2); } },
  { id: 'edge_rgt', name: 'Right Edge', draw: (ctx, s) => { ctx.fillRect(0, 0, s/2, s); } },
  { id: 'edge_bot', name: 'Bottom Edge', draw: (ctx, s) => { ctx.fillRect(0, 0, s, s/2); } },
  { id: 'edge_lft', name: 'Left Edge', draw: (ctx, s) => { ctx.fillRect(s/2, 0, s/2, s); } },
  // Outer corners (clockwise from top-left)
  { id: 'outer_top_lft', name: 'Outer Top-Left', draw: (ctx, s) => { ctx.fillRect(s/2, s/2, s/2, s/2); } },
  { id: 'outer_top_rgt', name: 'Outer Top-Right', draw: (ctx, s) => { ctx.fillRect(0, s/2, s/2, s/2); } },
  { id: 'outer_bot_rgt', name: 'Outer Bottom-Right', draw: (ctx, s) => { ctx.fillRect(0, 0, s/2, s/2); } },
  { id: 'outer_bot_lft', name: 'Outer Bottom-Left', draw: (ctx, s) => { ctx.fillRect(s/2, 0, s/2, s/2); } },
  // Inner corners (clockwise from bottom-right)
  { id: 'inner_bot_rgt', name: 'Inner Bottom-Right', draw: (ctx, s) => {
    ctx.fillRect(0, 0, s, s);
    ctx.clearRect(s/2, s/2, s/2, s/2);
  }},
  { id: 'inner_bot_lft', name: 'Inner Bottom-Left', draw: (ctx, s) => {
    ctx.fillRect(0, 0, s, s);
    ctx.clearRect(0, s/2, s/2, s/2);
  }},
  { id: 'inner_top_lft', name: 'Inner Top-Left', draw: (ctx, s) => {
    ctx.fillRect(0, 0, s, s);
    ctx.clearRect(0, 0, s/2, s/2);
  }},
  { id: 'inner_top_rgt', name: 'Inner Top-Right', draw: (ctx, s) => {
    ctx.fillRect(0, 0, s, s);
    ctx.clearRect(s/2, 0, s/2, s/2);
  }}
];

// State
const state = {
  image: null,
  zoom: 2,
  sliceDim: { width: 1, height: 1 },
  pan: { x: 0, y: 0 },
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  mousePos: { x: 0, y: 0 },
  isMouseOverImage: false,
  backgroundTile: null, // Canvas containing the background tile pixels
  backgroundTileCoords: null, // { x, y } in image coordinates
  // Bordered mode state
  borderedMode: false,
  borderedStep: 0,
  borderedTiles: [] // Array of canvas elements for each collected tile
};

// DOM Elements
const mainCanvas = document.getElementById('main-canvas');
const overlayCanvas = document.getElementById('overlay-canvas');
const mainCtx = mainCanvas.getContext('2d');
const overlayCtx = overlayCanvas.getContext('2d');
const container = document.getElementById('canvas-container');
const fileInput = document.getElementById('file-input');
const loadBtn = document.getElementById('load-btn');
const sliceDimInput = document.getElementById('slice-dim');
const zoomButtons = document.querySelectorAll('.zoom-btn');
const dropZone = document.getElementById('drop-zone');
const statusBar = document.getElementById('status-bar');
const borderedBtn = document.getElementById('bordered-btn');
const borderedUI = document.getElementById('bordered-ui');
const borderedPreview = document.getElementById('bordered-preview');
const borderedPreviewCtx = borderedPreview.getContext('2d');
const borderedInstruction = document.getElementById('bordered-instruction');
const borderedCancel = document.getElementById('bordered-cancel');

// Initialize
function init() {
  resizeCanvas();
  setupEventListeners();
  render();
}

function resizeCanvas() {
  const rect = container.getBoundingClientRect();
  mainCanvas.width = rect.width;
  mainCanvas.height = rect.height;
  overlayCanvas.width = rect.width;
  overlayCanvas.height = rect.height;
}

function setupEventListeners() {
  window.addEventListener('resize', () => {
    resizeCanvas();
    render();
  });

  // File loading
  loadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    container.style.background = '#1a2a4a';
  });
  container.addEventListener('dragleave', () => {
    container.style.background = '';
  });
  container.addEventListener('drop', handleDrop);

  // Slice dimension input
  sliceDimInput.addEventListener('input', parseSliceDim);
  sliceDimInput.addEventListener('change', parseSliceDim);

  // Zoom buttons
  zoomButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      state.zoom = parseInt(btn.dataset.zoom);
      zoomButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });

  // Mouse events for panning and preview
  mainCanvas.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  mainCanvas.addEventListener('mouseleave', handleMouseLeave);

  // Right-click to select background tile
  mainCanvas.addEventListener('contextmenu', handleRightClick);

  // Keyboard events
  window.addEventListener('keydown', handleKeyDown);

  // Bordered mode buttons
  borderedBtn.addEventListener('click', startBorderedMode);
  borderedCancel.addEventListener('click', cancelBorderedMode);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) loadImage(file);
}

function handleDrop(e) {
  e.preventDefault();
  container.style.background = '';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    loadImage(file);
  }
}

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.pan = { x: 0, y: 0 };
      dropZone.classList.add('hidden');
      updateStatus();
      render();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function parseSliceDim() {
  const value = sliceDimInput.value.trim().toLowerCase();
  const match = value.match(/^(\d+)\s*x\s*(\d+)$/);
  if (match) {
    state.sliceDim.width = Math.max(1, parseInt(match[1]));
    state.sliceDim.height = Math.max(1, parseInt(match[2]));
    sliceDimInput.style.borderColor = '';
  } else {
    sliceDimInput.style.borderColor = '#e94560';
  }
  updateStatus();
  renderOverlay();
}

function handleMouseDown(e) {
  if (!state.image) return;

  // In bordered mode, clicks capture tiles instead of panning
  if (state.borderedMode && state.isMouseOverImage) {
    handleBorderedClick();
    return;
  }

  state.isDragging = true;
  state.dragStart = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y };
  mainCanvas.classList.add('grabbing');
}

function handleMouseMove(e) {
  const rect = mainCanvas.getBoundingClientRect();
  state.mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

  if (state.isDragging) {
    state.pan = {
      x: e.clientX - state.dragStart.x,
      y: e.clientY - state.dragStart.y
    };
    render();
  } else {
    checkMouseOverImage();
    renderOverlay();
  }
}

function handleMouseUp() {
  state.isDragging = false;
  mainCanvas.classList.remove('grabbing');
}

function handleMouseLeave() {
  state.isMouseOverImage = false;
  renderOverlay();
}

function handleRightClick(e) {
  e.preventDefault();
  if (!state.image || !state.isMouseOverImage) return;

  const tileSize = 16;
  const imgPos = getImagePosition();

  // Calculate which tile the mouse is over in original image coordinates
  const imgX = (state.mousePos.x - imgPos.x) / state.zoom;
  const imgY = (state.mousePos.y - imgPos.y) / state.zoom;

  // Snap to 16px tile grid
  const tileX = Math.floor(imgX / tileSize) * tileSize;
  const tileY = Math.floor(imgY / tileSize) * tileSize;

  // Create a canvas to store the background tile
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = tileSize;
  bgCanvas.height = tileSize;
  const bgCtx = bgCanvas.getContext('2d');

  // Draw the tile from the image
  bgCtx.drawImage(
    state.image,
    tileX, tileY, tileSize, tileSize,
    0, 0, tileSize, tileSize
  );

  state.backgroundTile = bgCanvas;
  state.backgroundTileCoords = { x: tileX, y: tileY };

  updateStatus(`Background tile selected at (${tileX}, ${tileY})`);
  render();
}

function checkMouseOverImage() {
  if (!state.image) {
    state.isMouseOverImage = false;
    return;
  }

  const imgPos = getImagePosition();
  const scaledWidth = state.image.width * state.zoom;
  const scaledHeight = state.image.height * state.zoom;

  state.isMouseOverImage =
    state.mousePos.x >= imgPos.x &&
    state.mousePos.x < imgPos.x + scaledWidth &&
    state.mousePos.y >= imgPos.y &&
    state.mousePos.y < imgPos.y + scaledHeight;
}

function getImagePosition() {
  if (!state.image) return { x: 0, y: 0 };
  const scaledWidth = state.image.width * state.zoom;
  const scaledHeight = state.image.height * state.zoom;
  return {
    x: (mainCanvas.width - scaledWidth) / 2 + state.pan.x,
    y: (mainCanvas.height - scaledHeight) / 2 + state.pan.y
  };
}

function handleKeyDown(e) {
  if (e.code === 'Space' && state.isMouseOverImage && !state.isDragging) {
    e.preventDefault();
    sliceRegion();
  }
}

async function sliceRegion() {
  if (!state.image) return;

  const name = prompt('Enter a name for the sliced tiles (e.g., grass):');
  if (!name || !name.trim()) return;

  const tileName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const tileSize = 16;
  const { width: tilesX, height: tilesY } = state.sliceDim;
  const regionWidth = tilesX * tileSize;
  const regionHeight = tilesY * tileSize;

  // Calculate which tile the mouse is over in original image coordinates
  const imgPos = getImagePosition();
  const imgX = (state.mousePos.x - imgPos.x) / state.zoom;
  const imgY = (state.mousePos.y - imgPos.y) / state.zoom;

  // Snap to 16px tile grid (not region size)
  const startX = Math.floor(imgX / tileSize) * tileSize;
  const startY = Math.floor(imgY / tileSize) * tileSize;

  // Create zip
  const zip = new JSZip();

  // Create a temporary canvas for slicing
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = tileSize;
  tempCanvas.height = tileSize;
  const tempCtx = tempCanvas.getContext('2d');

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const srcX = startX + tx * tileSize;
      const srcY = startY + ty * tileSize;

      // Clear the temp canvas
      tempCtx.clearRect(0, 0, tileSize, tileSize);

      // If a background tile is selected, draw it first as the base layer
      if (state.backgroundTile) {
        tempCtx.drawImage(state.backgroundTile, 0, 0);
      }

      // Draw the tile on top (transparent areas will show background)
      tempCtx.drawImage(
        state.image,
        srcX, srcY, tileSize, tileSize,
        0, 0, tileSize, tileSize
      );

      // Convert to blob and add to zip
      const dataUrl = tempCanvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];
      const xStr = String(tx).padStart(2, '0');
      const yStr = String(ty).padStart(2, '0');
      zip.file(`${tileName}_${xStr}_${yStr}.png`, base64Data, { base64: true });
    }
  }

  // Generate and download zip
  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = `${tileName}_tiles.zip`;
  link.click();
  URL.revokeObjectURL(link.href);

  const bgNote = state.backgroundTile ? ' (with background)' : '';
  updateStatus(`Exported ${tilesX * tilesY} tiles as ${tileName}_tiles.zip${bgNote}`);
}

function render() {
  renderMain();
  renderOverlay();
}

function renderMain() {
  mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

  if (!state.image) return;

  const imgPos = getImagePosition();
  const scaledWidth = state.image.width * state.zoom;
  const scaledHeight = state.image.height * state.zoom;

  // Disable smoothing for pixel-perfect rendering
  mainCtx.imageSmoothingEnabled = false;

  mainCtx.drawImage(
    state.image,
    imgPos.x, imgPos.y,
    scaledWidth, scaledHeight
  );
}

function renderOverlay() {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (!state.image) return;

  const imgPos = getImagePosition();
  const tileSize = 16;

  // Draw orange highlight on selected background tile (always visible)
  if (state.backgroundTileCoords) {
    const bgScreenX = imgPos.x + state.backgroundTileCoords.x * state.zoom;
    const bgScreenY = imgPos.y + state.backgroundTileCoords.y * state.zoom;
    const bgScreenSize = tileSize * state.zoom;

    // Draw 30% orange overlay
    overlayCtx.fillStyle = 'rgba(255, 165, 0, 0.3)';
    overlayCtx.fillRect(bgScreenX, bgScreenY, bgScreenSize, bgScreenSize);

    // Draw orange border
    overlayCtx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
    overlayCtx.lineWidth = 2;
    overlayCtx.strokeRect(bgScreenX, bgScreenY, bgScreenSize, bgScreenSize);
  }

  // Draw hover preview (only when mouse is over image and not dragging)
  if (!state.isMouseOverImage || state.isDragging) return;

  const { width: tilesX, height: tilesY } = state.sliceDim;
  const regionWidth = tilesX * tileSize;
  const regionHeight = tilesY * tileSize;

  // Calculate which tile the mouse is over (snap to 16px grid, not region size)
  const imgX = (state.mousePos.x - imgPos.x) / state.zoom;
  const imgY = (state.mousePos.y - imgPos.y) / state.zoom;

  const gridX = Math.floor(imgX / tileSize) * tileSize;
  const gridY = Math.floor(imgY / tileSize) * tileSize;

  // Convert back to screen coordinates
  const screenX = imgPos.x + gridX * state.zoom;
  const screenY = imgPos.y + gridY * state.zoom;
  const screenWidth = regionWidth * state.zoom;
  const screenHeight = regionHeight * state.zoom;

  // Draw red rectangle with 70% opacity
  overlayCtx.fillStyle = 'rgba(233, 69, 96, 0.7)';
  overlayCtx.fillRect(screenX, screenY, screenWidth, screenHeight);

  // Draw 16x16 grid with darker lines
  overlayCtx.strokeStyle = 'rgba(139, 30, 50, 0.9)';
  overlayCtx.lineWidth = 1;

  const cellSize = tileSize * state.zoom;

  // Vertical lines
  for (let i = 0; i <= tilesX; i++) {
    const x = screenX + i * cellSize;
    overlayCtx.beginPath();
    overlayCtx.moveTo(x, screenY);
    overlayCtx.lineTo(x, screenY + screenHeight);
    overlayCtx.stroke();
  }

  // Horizontal lines
  for (let i = 0; i <= tilesY; i++) {
    const y = screenY + i * cellSize;
    overlayCtx.beginPath();
    overlayCtx.moveTo(screenX, y);
    overlayCtx.lineTo(screenX + screenWidth, y);
    overlayCtx.stroke();
  }

  // Draw outer border
  overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  overlayCtx.lineWidth = 2;
  overlayCtx.strokeRect(screenX, screenY, screenWidth, screenHeight);
}

function updateStatus(message) {
  if (message) {
    statusBar.textContent = message;
    return;
  }

  if (!state.image) {
    statusBar.textContent = 'No image loaded';
    return;
  }

  const { width, height } = state.sliceDim;
  const regionW = width * 16;
  const regionH = height * 16;
  const bgInfo = state.backgroundTileCoords
    ? ` | BG: (${state.backgroundTileCoords.x}, ${state.backgroundTileCoords.y})`
    : '';
  statusBar.textContent = `Image: ${state.image.width}x${state.image.height}px | Zoom: ${state.zoom}x | Selection: ${regionW}x${regionH}px (${width}x${height} tiles)${bgInfo}`;
}

// Bordered Mode Functions
function startBorderedMode() {
  if (!state.image) {
    updateStatus('Please load an image first');
    return;
  }

  state.borderedMode = true;
  state.borderedStep = 0;
  state.borderedTiles = [];

  // Set slice dimensions to 1x1
  sliceDimInput.value = '1x1';
  parseSliceDim();

  // Show bordered UI
  borderedUI.style.display = 'block';
  updateBorderedPreview();
  updateStatus('Bordered mode: Click on each tile type');
}

function cancelBorderedMode() {
  state.borderedMode = false;
  state.borderedStep = 0;
  state.borderedTiles = [];
  borderedUI.style.display = 'none';
  updateStatus();
}

function updateBorderedPreview() {
  const tileType = borderedTileTypes[state.borderedStep];
  const s = borderedPreview.width;

  // Clear with black (outside)
  borderedPreviewCtx.fillStyle = '#000';
  borderedPreviewCtx.fillRect(0, 0, s, s);

  // Draw red (inside) pattern
  borderedPreviewCtx.fillStyle = '#e94560';
  tileType.draw(borderedPreviewCtx, s);

  // Update instruction text
  borderedInstruction.innerHTML = `Click on: <strong>${tileType.name}</strong>`;
}

function handleBorderedClick() {
  const tileSize = 16;
  const imgPos = getImagePosition();

  // Calculate which tile the mouse is over in original image coordinates
  const imgX = (state.mousePos.x - imgPos.x) / state.zoom;
  const imgY = (state.mousePos.y - imgPos.y) / state.zoom;

  // Snap to 16px tile grid
  const tileX = Math.floor(imgX / tileSize) * tileSize;
  const tileY = Math.floor(imgY / tileSize) * tileSize;

  // Create a canvas to store this tile
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = tileSize;
  tileCanvas.height = tileSize;
  const tileCtx = tileCanvas.getContext('2d');

  // If a background tile is selected, draw it first
  if (state.backgroundTile) {
    tileCtx.drawImage(state.backgroundTile, 0, 0);
  }

  // Draw the tile from the image
  tileCtx.drawImage(
    state.image,
    tileX, tileY, tileSize, tileSize,
    0, 0, tileSize, tileSize
  );

  // Store this tile
  state.borderedTiles.push(tileCanvas);
  state.borderedStep++;

  // Check if we've collected all tiles
  if (state.borderedStep >= borderedTileTypes.length) {
    finishBorderedMode();
  } else {
    updateBorderedPreview();
    updateStatus(`Bordered mode: ${state.borderedStep}/${borderedTileTypes.length} tiles collected`);
  }
}

async function finishBorderedMode() {
  const name = prompt('Enter a name for the bordered tiles (e.g., water):');
  if (!name || !name.trim()) {
    cancelBorderedMode();
    return;
  }

  const tileName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');

  // Create zip
  const zip = new JSZip();

  // Add each tile to the zip
  for (let i = 0; i < borderedTileTypes.length; i++) {
    const tileType = borderedTileTypes[i];
    const tileCanvas = state.borderedTiles[i];

    const dataUrl = tileCanvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];
    zip.file(`${tileName}_${tileType.id}.png`, base64Data, { base64: true });
  }

  // Generate and download zip
  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = `${tileName}_bordered.zip`;
  link.click();
  URL.revokeObjectURL(link.href);

  const bgNote = state.backgroundTile ? ' (with background)' : '';
  updateStatus(`Exported 13 bordered tiles as ${tileName}_bordered.zip${bgNote}`);

  // Exit bordered mode
  state.borderedMode = false;
  state.borderedStep = 0;
  state.borderedTiles = [];
  borderedUI.style.display = 'none';
}

// Start
init();
parseSliceDim();

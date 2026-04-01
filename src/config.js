// â”€â”€â”€ STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LS = {
  get: (k) => { try { return JSON.parse(localStorage.getItem('pw_'+k)); } catch(e) { return null; } },
  set: (k,v) => { try { localStorage.setItem('pw_'+k, JSON.stringify(v)); } catch(e) {} },
};

let currentScreen = 'sl';
let currentUser = null; // logged in user
let selectedPayment = 'Pix';
let deliveryType = 'delivery';
let editingItemIdx = null;
let selectedEmoji = 'ðŸ”';
let selectedPhoto = null;
let selectedPhotos = []; // atÃ© 5 fotos por item
let cart = [];
let orderCounter = parseInt(localStorage.getItem('pw_order_counter') || '1000');
let flashItems = [];
let flashIdx = 0, flashTimer = null;
const FLASH_DUR = 5000;
let selectedPlan = 'basico';
let billingCycle = 'monthly';
let currentStoreSlug = null;
let ceoCurrentStoreIdx = null;
let pendingEmail = '';

// Game state
let gameActive = false, gameScore = 0, gTimer = null, gAnimFrame = null;
let bx = 80, by = 80, bvx = 4, bvy = 3;
const foodEmojis = ['ðŸ”','ðŸ•','ðŸŒ®','ðŸŒ¯','ðŸœ','ðŸ—','ðŸ§†','ðŸ¥ª','ðŸ°','ðŸ§'];

// Data stores (use localStorage for persistence)
function getUsers() { return LS.get('users') || []; }
function setUsers(u) { LS.set('users', u); }
function getSolicitations() { return LS.get('solics') || []; }
function setSolicitations(s) { LS.set('solics', s); }

// â”€â”€â”€ SUPABASE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SUPA_URL = 'https://nmttkjmfazcipefeakkx.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tdHRram1mYXpjaXBlZmVha2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTM3NjQsImV4cCI6MjA5MDI4OTc2NH0.MMTX_6iQJk7Uv3HPSk0m32_BihvqsWhHJ_qiRkw0WYo';

// ── LS helper ─────────────────────────────────────────────────────────────
export const LS = {
  get: (k) => { try { return JSON.parse(localStorage.getItem('pw_' + k)); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem('pw_' + k, JSON.stringify(v)); } catch (e) {} },
};

// ── State object (estado mutável compartilhado) ───────────────────────────
export const state = {
  currentScreen: 'sl',
  currentUser: null,
  selectedPayment: 'Pix',
  deliveryType: 'delivery',
  editingItemIdx: null,
  selectedEmoji: '🍔',
  selectedPhoto: null,
  selectedPhotos: [],
  cart: [],
  orderCounter: parseInt(localStorage.getItem('pw_order_counter') || '1000'),
  flashItems: [],
  flashIdx: 0,
  flashTimer: null,
  selectedPlan: 'basico',
  billingCycle: 'monthly',
  currentStoreSlug: null,
  ceoCurrentStoreIdx: null,
  pendingEmail: '',
  gameActive: false,
  gameScore: 0,
  gTimer: null,
  gAnimFrame: null,
  bx: 80, by: 80, bvx: 4, bvy: 3,
  realtimeEstabChannel: null,
  _realtimeReady: false,
};

// ── Constants ──────────────────────────────────────────────────────────────
export const FLASH_DUR = 5000;

export const foodEmojis = ['🍔', '🍕', '🌮', '🌯', '🍜', '🍗', '🧆', '🥪', '🎂', '🧋'];

export const SUPA_URL = 'https://nmttkjmfazcipefeakkx.supabase.co';
export const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tdHRram1mYXpjaXBlZmVha2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTM3NjQsImV4cCI6MjA5MDI4OTc2NH0.MMTX_6iQJk7Uv3HPSk0m32_BihvqsWhHJ_qiRkw0WYo';

// ── Data stores (localStorage) ─────────────────────────────────────────────
export function getUsers() { return LS.get('users') || []; }
export function setUsers(u) { LS.set('users', u); }
export function getSolicitations() { return LS.get('solics') || []; }
export function setSolicitations(s) { LS.set('solics', s); }

// ── Utility ────────────────────────────────────────────────────────────────
export function el(id) { return document.getElementById(id); }

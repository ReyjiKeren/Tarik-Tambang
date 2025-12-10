# Anti-Gravity Tug of War — Game Plan (Untuk Antigravity)

Dokumen ini berisi **struktur utama project**, **konsep desain UI/UX**, **teknologi yang digunakan**, dan **fitur interaktif** untuk minigame "Anti-Gravity Tug of War". Dibuat dalam format `.md` agar Antigravity dapat memahami dan memprosesnya dengan benar.

---

## 🏗 1. Struktur Utama Project
```
/project-root
│── index.html                → halaman utama / menu
│── game.html                 → halaman arena game
│── style.css                 → styling global + responsive
│
│── /assets                   → folder aset visual & audio
│     ├── icons/              → icon UI
│     ├── sounds/             → sfx tarikan, charge, win
│     └── svgs/               → rope, core, grid hologram
│
│── /scripts                  → seluruh source code javascript
│     ├── main.js             → logic menu & navigation
│     ├── game.js             → logic gameplay (progress, power)
│     ├── render.js           → render rope, core, efek visual
│     └── rtc.js              → sistem multiplayer WebRTC (tanpa backend)
│
│── /components               → komponen UI reusable
│     └── ui-elements.js      → button, modal, neon panel
│
│── /docs
      └── game-plan.md        → dokumen rencana (file ini)
```

---

## 🎨 2. Konsep Desain UI/UX (Anti-Gravity Vibe)

### **Tema Visual Utama**
Futuristik neon hologram dengan efek melayang, cahaya lembut, dan grid 3D.

### **Elemen UI**
- **Gravity Core**: orb neon dengan efek pulsating & glowing.
- **Energy Rope**: garis hologram dengan animasi energy-flow.
- **Arena Grid**: background hologram dengan depth & parallax.
- **Power Bar**: bar neon yang berkembang sesuai tap/charge.
- **Floating Panels**: UI panel transparan seperti HUD sci-fi.

### **Style Umum**
- Warna utama: **Cyan**, **Magenta**, **Purple Neon**, **Electric Blue**.
- Border UI: soft glow.
- Transisi: fade + slide + ripple hologram.

### **UX Responsif**
- **Mobile**: tombol tap area besar di kiri/kanan.
- **Tablet**: layout lebih longgar, panel melayang.
- **PC**: kontrol via mouse/keyboard.
- Semua elemen UI memakai `clamp()` CSS agar skalanya otomatis.

---

## ⚙ 3. Teknologi yang Digunakan (Tanpa Backend)

### **Frontend**
- **HTML5** → struktur halaman.
- **CSS3** → neon UI, animasi ringan, responsive layout.
- **JavaScript Vanilla** → logic utama tanpa framework berat.
- **GSAP / AnimeJS** → animasi rope, core, dan neon float.
- **Canvas 2D** → efek energi simple & partikel.

### **Multiplayer (Tanpa Backend)**
- **WebRTC DataChannel**
  - Sinkronisasi power dan progress antar pemain.
  - P2P, sehingga tidak perlu database/server API.

### **Optimasi Untuk HP Spek Rendah**
- Mode Low Graphics otomatis.
- Partikel dibatasi.
- Efek glow berat diganti blur ringan.
- Render rope sederhana untuk device lemah.

---

## 🧩 4. Fitur Interaktif Utama

### **A. Mekanik Tarik Tambang**
- Tap cepat → tarikan kecil beruntun.
- Hold 1–2 detik → charge power.
- Release → tarikan besar dengan efek "gravity shock".
- Gravity core bergeser sesuai power akumulasi.

### **B. Efek Anti-Gravity**
- Floating background hologram.
- Particle glow melayang.
- Rope berdenyut saat tarik besar.
- Core bergetar saat mendekati kemenangan.

### **C. Multiplayer WebRTC**
- Create Room (generate kode otomatis).
- Join Room via kode.
- Sync real-time antara dua pemain.
- Efisiensi data: hanya mengirim state power & progress.

### **D. UI Interaktif**
- Neon button hover ripple.
- Slide-in panel.
- Energy pulse feedback saat tap/hold.

### **E. Result Screen**
- Animasi kemenangan (core tersedot ke arah pemenang).
- Tombol rematch.
- Statistik power.

---

## 🚀 5. Flow Navigasi
1. **Index (Menu Utama)**
   - Play
   - Quick Match
   - How to Play
2. **Create / Join Room**
3. **Arena Game**
   - Rope + Core + Power Bars
   - Control Area
4. **Result Screen**
   - Winner / Loser
   - Rematch

---

## 📌 6. Tujuan Utama Proyek
- Membuat minigame tarik tambang futuristik yang ringan.
- Support mobile, tablet, PC.
- Multiplayer tanpa backend.
- Visual menarik untuk menarik rasa penasaran pengguna.

---

## 🔑 7. Catatan Untuk Antigravity
- File ini berfungsi sebagai panduan lengkap.
- Semua folder dan nama file **harus dibuat sesuai struktur**.
- Efek visual mengikuti style yang dijelaskan.
- Tidak menggunakan backend API/database.
- WebRTC digunakan hanya untuk sinkronisasi player.

---

Selesai. File ini siap dipakai oleh Antigravity untuk mulai membangun project minigame "Anti-Gravity Tug of War".


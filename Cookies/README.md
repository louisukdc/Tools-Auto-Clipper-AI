# 🎥 YT Member-Only Downloader Web App

[Indonesian]  
Aplikasi web premium berbasis Node.js untuk mengunduh video YouTube standar maupun khusus member secara real-time. Dilengkapi dengan antarmuka *glassmorphism* modern, visualisasi progress bar, kecepatan download, sisa estimasi waktu (ETA), dan streaming log konsol secara langsung.

[English]  
A premium Node.js-based web application to download standard or Member-Only YouTube videos in real-time. Features a modern glassmorphic interface, real-time progress bar visualization, download speeds, estimated time remaining (ETA), and direct streaming of console logs.

---

## ✨ Fitur / Features

*   **Real-time Progress Tracker:** Menampilkan persentase download, kecepatan, sisa waktu (ETA), dan ukuran file secara instan.
*   **Dynamic Cookies Scanner:** Memindai dan menampilkan seluruh file cookies (`.txt` atau `.json`) yang ada di folder secara otomatis.
*   **Embedded Challenge Solver:** Secara bawaan menggunakan Node.js dan solver EJS untuk menembus tantangan digital signature YouTube terbaru.
*   **Scrolling Terminal Logs:** Menyediakan log konsol retro secara live untuk memudahkan pemantauan proses.
*   **🔒 Git & GitHub Security:** Pra-konfigurasi `.gitignore` ketat untuk memastikan file cookies pribadi dan video berukuran besar tidak akan pernah bocor atau terunggah ke repositori GitHub Anda.

---

## 🛠️ Prasyarat / Prerequisites

Aplikasi ini membutuhkan alat-alat berikut yang terinstal di komputer Anda (semuanya sudah terverifikasi dan siap pakai di sistem Anda):
1.  **Node.js** (v22+ direkomendasikan)
2.  **yt-dlp** (versi terbaru untuk menangani perubahan YouTube)
3.  **FFmpeg** (untuk menggabungkan aliran video HD & audio berkualitas tinggi)

---

## 🚀 Cara Menjalankan / How to Run

1.  Buka terminal/PowerShell di folder ini.
2.  Jalankan perintah berikut untuk menginstal dependensi (hanya perlu sekali):
    ```bash
    npm install
    ```
    *Catatan untuk Windows:* Jika Powershell memblokir skrip, gunakan perintah bypass:
    ```bash
    npm.cmd install
    ```
3.  Jalankan server aplikasi:
    ```bash
    npm start
    ```
4.  Buka browser Anda dan akses:
    ```
    http://localhost:3000
    ```

---

## 🍪 Panduan Ekspor Cookies / Cookies Export Guide

Untuk mengunduh video khusus member, Anda harus menyertakan session cookies akun YouTube yang memiliki keanggotaan aktif:

1.  Buka browser tempat Anda masuk (login) ke akun YouTube member Anda.
2.  Instal ekstensi browser **Get cookies.txt LOCALLY** (aman, berjalan lokal, menghasilkan format Netscape langsung).
3.  Buka situs [YouTube](https://www.youtube.com), klik ikon ekstensi tersebut, lalu pilih **Export** untuk mengunduh file cookies.
4.  Pindahkan atau simpan file cookies tersebut ke dalam folder proyek ini dengan nama **`Untitled-2.txt`** (atau nama apa saja dengan ekstensi `.txt` / `.json`).
5.  Buka Web UI (`http://localhost:3000`), klik tombol **Refresh** di sebelah pilihan cookies, pilih file cookies Anda, masukkan tautan video, lalu klik **Mulai Download**.

---

## 📂 Struktur Proyek / Project Structure

```
.
├── public/                  # Aset Frontend
│   ├── index.html           # Struktur antarmuka premium
│   ├── index.css            # Desain glassmorphism & animasi
│   └── app.js               # Kontroler WebSockets & DOM
├── .gitignore               # Aturan keamanan Git (PENTING)
├── package.json             # Dependensi proyek (Express + Socket.io)
├── server.js                # Backend server (Child processes & WebSockets)
└── README.md                # Dokumentasi proyek
```

---

## 🔒 Kebijakan Keamanan Git / Git Security Policy

> [!WARNING]
> **PENTING / IMPORTANT:**
> File `.gitignore` telah dikonfigurasi untuk mengabaikan seluruh file berikut agar tidak terunggah ke GitHub:
> *   Seluruh file cookies (`Untitled-*.txt`, `Untitled-*.json`, `cookies.txt`, dll).
> *   Seluruh file video hasil download (`*.mp4`, `*.webm`, `*.mkv`, `*.part`).
> *   Folder `node_modules/`.
> 
> Anda dapat melakukan `git init`, `git add .`, dan `git commit` dengan sangat aman tanpa khawatir membocorkan akun YouTube atau mengunggah file video berukuran gigabyte ke GitHub.

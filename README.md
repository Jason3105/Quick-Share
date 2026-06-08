# Quick Share

![Quick Share](https://img.shields.io/badge/Quick_Share-Secure_P2P_Transfer-blue)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)
![WebRTC](https://img.shields.io/badge/WebRTC-P2P-orange)

Quick Share is a fast, secure, and modern peer-to-peer (P2P) file and folder sharing web application. It allows you to share files instantly across devices without relying on third-party cloud storage, ensuring privacy and speed. 

🌐 **Live Demo:** [https://quicksharep2p.onrender.com/](https://quicksharep2p.onrender.com/)

## ✨ Features

- **Peer-to-Peer Transfer:** Files are transferred directly between sender and receiver using WebRTC DataChannels. No files are stored on any server.
- **Share Files & Folders:** Select multiple files or entire directories. Folders are automatically zipped in the browser before being sent.
- **Multiple Ways to Connect:**
  - **6-Digit Room Code:** Simple code to share verbally or via message.
  - **Direct Link:** Copy a URL that automatically joins the room.
  - **QR Code:** Scan the QR code with a mobile device for instant connection.
- **Relay Mode:** Fallback support for restrictive networks (like corporate or college WiFi) using TURN/STUN relay servers.
- **Real-Time Progress:** Track connection state, zipping progress, and transfer percentages in real-time.
- **Secure & Encrypted:** Leveraging WebRTC's built-in encryption for all data transfers.
- **Modern UI:** Built with Tailwind CSS, Radix UI, and Lucide icons for a clean, responsive, and intuitive user experience.

## 🛠️ Technology Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (React 19)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:** [Radix UI](https://www.radix-ui.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **P2P Communication:** [WebRTC](https://webrtc.org/)
- **Signaling Server:** [Socket.io](https://socket.io/) (Handles initial peer discovery and room creation)
- **File Utilities:** `jszip` (for folder compression)
- **QR Utilities:** `qrcode`, `@zxing/browser`

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd "Quick Share"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env.local` file in the root directory (if you want to override the default signaling server URL):
   ```env
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   This command starts the Next.js frontend and the Socket.io signaling server simultaneously via `server-combined.js`.

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

- `/components`: Reusable UI components (Senders, Receivers, QR display/scanner, etc.)
- `/hooks`: Custom React hooks, notably `use-webrtc.ts` which encapsulates all P2P connection logic.
- `/lib`: Utility functions (e.g., `zip-utils.ts` for file compression).
- `/app`: Next.js App Router pages and API routes.
- `server-combined.js`: Custom Node.js server that handles both the Next.js app and the Socket.io signaling.

## 🤝 How it Works

1. **Signaling Phase:** When a sender creates a room, a connection is established with the Socket.io server. The server generates a unique 6-digit room code.
2. **Joining Phase:** The receiver enters the code or scans the QR code, joining the same Socket.io room.
3. **WebRTC Handshake:** Sender and receiver exchange ICE candidates and session descriptions (SDP) via the signaling server to negotiate a direct P2P connection.
4. **Data Transfer:** Once the WebRTC DataChannel is open, the direct P2P transfer begins. The signaling server is no longer involved in the data path.

## 📄 License

This project is open-source and available under the MIT License.

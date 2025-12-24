# Quick Share - WebRTC File Sharing

A modern, peer-to-peer file sharing application built with Next.js and WebRTC. Share files directly between browsers with no storage, no limits, and complete privacy.

## ✨ Features

- **🚀 Real-time P2P File Transfer** - Files transfer directly between browsers using WebRTC
- **🔒 Auto-Rotating QR Codes** - QR codes refresh every 10 seconds for enhanced security
- **📱 Session-Based Access** - Once connected, your session remains active
- **🌓 Dark/Light Mode** - Beautiful UI with theme support
- **💾 No File Size Limits** - Transfer any file, any size
- **🔐 No Login Required** - Simple, frictionless sharing experience
- **🎨 Modern UI** - Built with shadcn/ui and Tailwind CSS

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: shadcn/ui, Tailwind CSS
- **P2P Transfer**: WebRTC Data Channels
- **Signaling**: Socket.io
- **QR Generation**: qrcode library
- **Theme**: next-themes

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
\`\`\`bash
git clone <your-repo-url>
cd "Quick Share"
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

This will start:
- Next.js dev server on [http://localhost:3000](http://localhost:3000)
- Socket.io signaling server on port 3001

### Production Deployment

For production, you'll need to deploy:
1. The Next.js app (Vercel, Netlify, etc.)
2. The Socket.io server (separate Node.js hosting)

Update `.env.local` with your production Socket.io server URL:
\`\`\`
NEXT_PUBLIC_SOCKET_URL=https://your-signaling-server.com
\`\`\`

## 📖 How It Works

### Architecture

1. **Sender uploads file** → Creates a room with unique 6-character code
2. **QR code generates** → Auto-refreshes every 10 seconds with time-based token
3. **Receiver joins** → Enters code or scans QR (valid within 20s window)
4. **WebRTC connects** → Direct peer-to-peer connection established
5. **File transfers** → Direct browser-to-browser, no server storage
6. **Download complete** → File received and ready to download

### Security Features

- **Time-based tokens**: QR codes expire every 10 seconds
- **Session validation**: Only fresh scans allowed for new connections
- **Active sessions persist**: Once connected, users stay authenticated
- **No server storage**: Files never touch the server
- **Direct encryption**: WebRTC provides built-in encryption

## 🎯 Usage

### Sending Files

1. Click "Send Files"
2. Select any file from your device
3. Share the 6-character code or QR code
4. Wait for receiver to connect
5. Click "Send File" when ready

### Receiving Files

1. Click "Receive Files"
2. Enter the 6-character code (or scan QR)
3. Wait for connection
4. File downloads automatically
5. Click "Download" to save

## 🔧 Configuration

### Environment Variables

Create `.env.local` in the root directory:

\`\`\`env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
\`\`\`

### STUN/TURN Servers

The app uses Google's free STUN servers by default. For better connectivity across restrictive networks, consider adding TURN servers in `hooks/use-webrtc.ts`:

\`\`\`typescript
iceServers: [
  { urls: "stun:stun.l.google.com:19302" },
  { 
    urls: "turn:your-turn-server.com",
    username: "username",
    credential: "password"
  },
]
\`\`\`

## 📁 Project Structure

\`\`\`
Quick Share/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout with theme provider
│   └── page.tsx             # Main landing page
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── file-sender.tsx      # File upload & sharing UI
│   ├── file-receiver.tsx    # File download UI
│   ├── qr-code-display.tsx  # Auto-rotating QR code
│   ├── theme-provider.tsx   # Theme context
│   └── theme-toggle.tsx     # Dark/light mode toggle
├── hooks/
│   └── use-webrtc.ts        # WebRTC & Socket.io logic
├── lib/
│   └── utils.ts             # Utility functions
├── server.js                # Socket.io signaling server
└── package.json
\`\`\`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- [WebRTC](https://webrtc.org/) for peer-to-peer technology
- [shadcn/ui](https://ui.shadcn.com/) for beautiful components
- [Socket.io](https://socket.io/) for signaling
- [Next.js](https://nextjs.org/) for the framework

## 🐛 Known Issues & Roadmap

- [ ] Add QR code scanning functionality
- [ ] Implement multiple file transfers
- [ ] Add file transfer cancellation
- [ ] Support folder sharing
- [ ] Add transfer speed indicator
- [ ] Mobile app versions (React Native)

## 💬 Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ using Next.js and WebRTC

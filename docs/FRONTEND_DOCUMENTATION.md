# VoyagerBot — Frontend Documentation

> Next.js 14 + React 18 web & Android control interface
> **Version:** 1.0 | **Last Updated:** November 2025 | **Framework:** Next.js 14 + React 18 + TypeScript

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Installation & Setup](#installation--setup)
5. [Project Structure](#project-structure)
6. [Pages & Routing](#pages--routing)
7. [Components](#components)
8. [State Management](#state-management)
9. [AI Integration](#ai-integration)
10. [Mobile App](#mobile-app)
11. [Styling & Theme](#styling--theme)
12. [Development Guide](#development-guide)

---

## Overview

VoyagerBot frontend is a modern, responsive web application built with Next.js 14, providing an intuitive interface for controlling and monitoring the robot. It features real-time video streaming, voice-controlled AI commands, comprehensive telemetry visualization, and can be deployed as both a web app and Android mobile app.

### Key Features

- **Real-time Control** — WebSocket-based robot control with minimal latency
- **Live Video Streaming** — JPEG video stream with tracking overlay
- **AI Voice Assistant** — Google Gemini-powered voice commands
- **Mobile Support** — Responsive design + native Android app (Capacitor)
- **Telemetry Dashboard** — Real-time system metrics visualization
- **Dark Theme** — Modern dark UI with orange accent colors
- **Offline-Ready** — Works without backend for UI development

---

## Technology Stack

### Core Framework

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 14.2.25 | React framework with App Router |
| React | 18.3.1 | UI library |
| TypeScript | 5.x | Type-safe JavaScript |
| Node.js | 18+ | Runtime environment |

### UI & Styling

| Library | Version | Purpose |
|--------|---------|---------|
| Tailwind CSS | 3.4.17 | Utility-first CSS framework |
| Shadcn UI | Latest | Component library |
| Radix UI | Various | Headless UI primitives |
| Lucide React | 0.454.0 | Icon library |
| Geist Font | 1.3.1 | Typography |

### Real-time & AI

| Library | Version | Purpose |
|--------|---------|---------|
| Socket.IO Client | 4.8.1 | WebSocket communication |
| @google/generative-ai | 0.24.1 | Google Gemini AI SDK |
| @google/genai | 1.29.0 | Additional Gemini features |

### Mobile App

| Library | Version | Purpose |
|--------|---------|---------|
| @capacitor/core | 7.4.4 | Native app runtime |
| @capacitor/android | 7.4.4 | Android platform support |
| @capacitor/cli | 7.4.4 | Build tools |

### Charts & Forms

| Library | Purpose |
|--------|---------|
| recharts 2.15.0 | Data visualization |
| react-hook-form 7.54.1 | Form management |
| zod 3.24.1 | Schema validation |

---

## Architecture

### Application Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Next.js App Router                      │
│                  (app directory)                        │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌─────────────┐  ┌──────────────┐
│    Pages     │  │  Components │  │     Lib      │
│              │  │             │  │              │
│ • Control    │  │ • Camera    │  │ • Socket     │
│ • AI         │  │ • Control   │  │ • IP Storage │
│ • Telemetry  │  │ • UI (Radix)│  │ • Hooks      │
│ • Settings   │  │ • Charts    │  │ • Utils      │
└──────────────┘  └─────────────┘  └──────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│                State Management Layer                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │           RobotSocketProvider (React Context)    │  │
│  │  • Socket connection state  • Video frames       │  │
│  │  • Tracking data            • Motor status       │  │
│  │  • Telemetry metrics        • Alerts             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌─────────────┐  ┌──────────────┐
│  WebSocket   │  │  REST API   │  │  Google AI   │
│ (Socket.IO)  │  │   (Fetch)   │  │  (Gemini)    │
│ ws://pi:8765 │  │http://pi:8000│  │  Cloud API  │
└──────────────┘  └─────────────┘  └──────────────┘
```

### Data Flow

```
Backend WebSocket ──→ Socket.IO Client ──→ React Context ──→ Components
                                 │
User Input ──→ Components ──→ Socket.IO Client ──→ Backend
AI Voice   ──→ Google Gemini ──→ Command Parser ──→ Socket.IO ──→ Backend
```

### Page Routing (App Router)

```
app/
├── page.tsx                # Dashboard           /
├── robot-control/page.tsx  # Robot Control       /robot-control
├── ai/page.tsx             # AI Assistant        /ai
├── telemetry/page.tsx      # Telemetry           /telemetry
├── settings/page.tsx       # Settings            /settings
├── command-center/page.tsx # Command Center      /command-center
├── operations/page.tsx     # Operations          /operations
├── systems/page.tsx        # Systems             /systems
├── intelligence/page.tsx   # Intelligence        /intelligence
└── agent-network/page.tsx  # Agent Network       /agent-network
```

---

## Installation & Setup

### Prerequisites

- Node.js 18.x or higher
- npm, yarn, or pnpm
- VoyagerBot backend running (for full functionality)

### Steps

```bash
# 1. Clone repository
git clone https://github.com/aka-nahal/voyagerbot.git
cd voyagerbot/frontend

# 2. Install dependencies
npm install

# 3. Configure environment (optional)
# Create .env.local
NEXT_PUBLIC_API_URL=http://192.168.1.100:8000
NEXT_PUBLIC_WS_URL=ws://192.168.1.100:8765
NEXT_PUBLIC_GEMINI_API_KEY=your_key_here

# 4. Run development server
npm run dev
# Open http://localhost:3000

# 5. Build for production
npm run build
npm start
```

### Network Configuration

The dev and production servers bind to all interfaces so you can access from any device on the same network:

```json
"scripts": {
  "dev":   "next dev -H 0.0.0.0 -p 3000",
  "start": "next start -H 0.0.0.0 -p 3000"
}
```

Access from: `http://localhost:3000` · `http://<your-ip>:3000` · Mobile on same Wi-Fi

---

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main dashboard
│   ├── robot-control/
│   ├── ai/
│   ├── telemetry/
│   ├── settings/
│   └── ...
│
├── components/
│   ├── camera-feed.tsx     # Live video stream component
│   ├── control-pad.tsx     # Joystick control component
│   └── ui/                 # Shadcn UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ...
│
├── lib/
│   ├── robot-socket.tsx    # Socket.IO client & context
│   ├── ip-storage.ts       # IP address management
│   └── utils.ts            # Utility functions
│
├── hooks/
│   └── useLiveAssistant.ts # AI voice assistant hook
│
├── styles/
│   └── globals.css         # Tailwind imports & customs
│
├── public/                 # Static assets
│
├── android/                # Capacitor Android project
│
├── capacitor.config.ts
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Pages & Routing

### Main Dashboard — `app/page.tsx` (`/`)

Central navigation hub.

**Features:** Section tabs · IP address configuration dialog · Connection status indicator · Animated preloader · Responsive sidebar (desktop) / mobile menu

**Sections:** CONTROL · AI · TELEMETRY · SETTINGS

---

### Robot Control — `app/robot-control/page.tsx` (`/robot-control`)

Main robot control interface.

**Features:** Live camera feed with overlay · Manual joystick control · Mode switching (Manual / Auto / Patrol) · Color selection for tracking · Emergency stop · Real-time status display

**State used:**
```typescript
const {
  isConnected, videoFrame, trackingData, motorStatus,
  sendManualControl, changeMode, emergencyStop, changeColor
} = useRobotSocket();
```

---

### AI Page — `app/ai/page.tsx` (`/ai`)

AI-powered voice control interface.

**Features:** Google Gemini voice assistant · Microphone input · Text input alternative · Command queue visualization · Integrated camera feed · Emergency stop

**Hook used:**
```typescript
const {
  status, isListening, transcript, response,
  commandQueue, startListening, stopListening,
  sendTextMessage, cancelCommand
} = useLiveAssistant(ipAddress);
```

---

### Telemetry — `app/telemetry/page.tsx` (`/telemetry`)

System monitoring and metrics visualization.

**Metrics displayed:** CPU usage (%) · CPU temperature (°C) · RAM usage (MB, %) · Processing FPS · Streaming FPS · Motor speeds · Connection status

---

### Settings — `app/settings/page.tsx` (`/settings`)

Application configuration.

**Features:** Backend IP address management · Connection testing · Network information · Control preferences · Clear saved settings

---

## Components

### `CameraFeed` — `components/camera-feed.tsx`

Displays live video stream with tracking overlay.

```typescript
interface CameraFeedProps {
  videoFrame?:   string;       // Base64 JPEG
  trackingData?: TrackingData;
  isConnected:   boolean;
  className?:    string;
}
```

**Features:** Base64 JPEG rendering · Detection marker overlay · 3×3 grid overlay · FPS counter · Connection indicator · Distance indicator

**Tracking overlay:** Green circle (marker detected) · Crosshair at marker center · Distance text · Confidence indicator

---

### `ControlPad` — `components/control-pad.tsx`

Joystick-based robot directional control.

```typescript
interface ControlPadProps {
  onCommand: (direction: Direction, speed: number) => void;
  disabled?: boolean;
}
```

**Features:** Touch & mouse joystick · 8-directional control · Speed adjustment 30–100% · Left/right rotation buttons · Command repeat · Visual feedback

```tsx
<ControlPad
  onCommand={(direction, speed) => sendManualControl(direction, speed)}
  disabled={!isConnected}
/>
```

---

### Shadcn UI Components — `components/ui/`

| Category | Components |
|----------|-----------|
| Layout | Card, Separator, ScrollArea, Tabs |
| Inputs | Button, Input, Select, Checkbox, Switch, Slider, RadioGroup |
| Feedback | Toast, Dialog, AlertDialog, Progress, Badge, Tooltip |
| Navigation | NavigationMenu, Menubar, DropdownMenu, ContextMenu |
| Overlays | Popover, HoverCard, Sheet |

---

## State Management

### `RobotSocketProvider` — `lib/robot-socket.tsx`

Centralized Socket.IO connection and global state.

**Provider:**
```tsx
<RobotSocketProvider>
  {/* App components */}
</RobotSocketProvider>
```

**`useRobotSocket()` hook:**
```typescript
const {
  // Connection
  isConnected, ipAddress, setIpAddress,

  // Data streams
  videoFrame,     // string | null  — Base64 JPEG
  trackingData,   // TrackingData | null
  motorStatus,    // MotorStatus | null
  telemetry,      // Telemetry | null
  alerts,         // Alert[]
  availableColors, // Color[]

  // Control functions
  sendManualControl,  // (direction, speed) => void
  changeMode,         // (mode) => void
  sendAutoCommand,    // (command) => void
  emergencyStop,      // () => void
  changeColor,        // (color) => void
  fetchColors,        // () => Promise<void>
} = useRobotSocket();
```

**WebSocket events handled:** `connect` · `disconnect` · `video_frame` · `tracking_data` · `motor_status` · `telemetry` · `alert` · `color_changed`

---

### IP Address Storage — `lib/ip-storage.ts`

Persists backend IP address in `localStorage`.

```typescript
getStoredIpAddress(): string | null
setStoredIpAddress(ip: string): void
validateIpAddress(ip: string): boolean
formatIpAddress(ip: string): string
getBackendUrl(ip: string): string
```

---

## AI Integration

### Google Gemini Live API — `hooks/useLiveAssistant.ts`

Natural language voice control for the robot.

```typescript
const {
  status,         // 'ready' | 'listening' | 'processing'
  isListening,    // boolean
  transcript,     // string — current speech
  response,       // string — AI response
  commandQueue,   // Command[]
  startListening,
  stopListening,
  sendTextMessage,
  cancelCommand
} = useLiveAssistant(ipAddress);
```

**Features:** Web Speech API for speech-to-text · Gemini Live API for interpretation · Command queue management · Text-to-speech responses · Context-aware robot control

**Example commands:**
```
"Move forward"             → drives forward
"Follow the blue marker"   → changes color + enables auto mode
"Stop"                     → emergency stop
"What's the CPU temp?"     → reads telemetry aloud
```

**Environment setup:**
```bash
# .env.local
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
```

---

## Mobile App

### Capacitor Android App

**Configuration** — `capacitor.config.ts`:
```typescript
const config: CapacitorConfig = {
  appId:   'com.voyagerbot.app',
  appName: 'VoyagerBot',
  webDir:  'out',
  server:  { androidScheme: 'https' }
};
```

**Build Steps:**
```bash
# 1. Build Next.js for Android
npm run build:android
# or manually:
npm run build && npx cap sync android

# 2. Open in Android Studio
npx cap open android

# 3. Build APK
# Android Studio → Build → Build APK(s)
# or use PowerShell:
.\build-apk.ps1
```

**Requirements:** Android Studio · Java JDK 11+ · Android SDK · Gradle

---

## Styling & Theme

### Color System

Uses CSS custom properties (HSL):

```css
:root {
  --background:  0 0% 100%;
  --foreground:  0 0% 3.9%;
  --primary:     25 95% 53%; /* Orange */
}

.dark {
  --background:  0 0% 3.9%;   /* Dark gray */
  --foreground:  0 0% 98%;
  --primary:     25 95% 53%;  /* Orange accent */
}
```

**Theme:** Dark (Neutral 900 background) with Orange primary accent.

### Typography

```typescript
import { GeistSans } from 'geist/font/sans';
// Applied via <html className={GeistSans.className}>
```

### Responsive Breakpoints

| Breakpoint | Width |
|-----------|-------|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1536px |

---

## Development Guide

### Adding a New Page

```bash
mkdir app/my-page && touch app/my-page/page.tsx
```

```typescript
'use client';
export default function MyPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold">My Page</h1>
    </div>
  );
}
```

Then add to navigation in `app/page.tsx`.

### Adding a New Component

```typescript
// components/my-component.tsx
interface MyComponentProps { title: string; }

export function MyComponent({ title }: MyComponentProps) {
  return <div>{title}</div>;
}
```

### Adding a Shadcn Component

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
```

### Connecting to the Backend

```typescript
'use client';
import { useRobotSocket } from '@/lib/robot-socket';

export default function MyPage() {
  const { isConnected, videoFrame, sendManualControl } = useRobotSocket();
  return <div>{isConnected ? 'Connected' : 'Disconnected'}</div>;
}
```

### Performance Optimization

```typescript
// Code splitting
import dynamic from 'next/dynamic';
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>
});

// Memoization
import { memo, useMemo, useCallback } from 'react';
const MemoizedComponent = memo(MyComponent);
```

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Module not found | `rm -rf node_modules && npm install` |
| Type errors | Run `npm run build` to see TypeScript errors |
| Port in use | `npm run dev -- -p 3001` |
| WebSocket failed | Check backend IP, verify backend is running, check firewall |

---

## API Reference

### `useRobotSocket` Hook (full signature)

```typescript
const {
  isConnected:        boolean,
  ipAddress:          string,
  setIpAddress:       (ip: string) => void,
  videoFrame:         string | null,
  trackingData:       TrackingData | null,
  motorStatus:        MotorStatus | null,
  telemetry:          Telemetry | null,
  alerts:             Alert[],
  availableColors:    Color[],
  sendManualControl:  (direction: Direction, speed: number) => void,
  changeMode:         (mode: 'manual' | 'auto') => void,
  sendAutoCommand:    (command: string) => void,
  emergencyStop:      () => void,
  changeColor:        (color: string) => void,
  fetchColors:        () => Promise<void>
} = useRobotSocket();
```

### `useLiveAssistant` Hook (full signature)

```typescript
const {
  status:          'ready' | 'listening' | 'processing',
  isListening:     boolean,
  transcript:      string,
  response:        string,
  commandQueue:    Command[],
  startListening:  () => void,
  stopListening:   () => void,
  sendTextMessage: (text: string) => void,
  cancelCommand:   (id: string) => void
} = useLiveAssistant(ipAddress: string);
```

---

*For backend details see [BACKEND_DOCUMENTATION.md](BACKEND_DOCUMENTATION.md)*
*For complete feature reference see [FEATURES_DOCUMENTATION.md](FEATURES_DOCUMENTATION.md)*

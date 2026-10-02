# HackMate 🚀

### AI-powered Hackathon Team Finder

HackMate is a real-time platform that helps students and developers discover compatible teammates, build project teams, and communicate with their teammates in one place.

## 🌐 Live Demo

https://hackmate-navy.vercel.app/

## 📦 Repository

https://github.com/Nitishxai/HackMate

## 🎯 Problem

Finding the right teammates for hackathons and technical projects can be difficult.

People often have different skills, but there is no simple way to discover complementary teammates, connect with them, form a team, and communicate in one workflow.

## 💡 Solution

HackMate brings teammate discovery, skill matching, connection requests, project creation, team management, and real-time messaging together in a single platform.

## ✨ Key Features

- 👤 User authentication
- 🔎 Discover potential teammates
- 🧠 Skill-based teammate matching
- 🤝 Connection requests and acceptance
- 🚀 Create and manage hackathon projects
- 👥 Team formation and management
- 💬 Real-time private messaging
- 🔄 Persistent conversations
- 📝 Profile editing and skill management
- 📱 Responsive modern interface

## 💬 CometChat Integration

HackMate uses **CometChat** for real-time private communication between accepted teammates.

The integration includes:

- CometChat authentication
- Private 1-to-1 messaging
- Real-time message delivery
- Conversation persistence
- Secure server-side authentication token generation
- Supabase Edge Function for CometChat authentication

## 🛠️ Tech Stack

### Frontend

- React
- Vite
- JavaScript
- CSS

### Backend & Services

- Supabase
- Supabase Authentication
- Supabase Database
- Supabase Edge Functions

### Real-Time Communication

- CometChat

### Deployment

- Vercel

### Development

- Git
- GitHub
- CometChat Skills / MCP-powered development workflow

## 🔐 Architecture

The application uses Supabase for authentication, database operations, and server-side functions.

CometChat authentication is handled through a Supabase Edge Function so sensitive CometChat credentials are not exposed in the frontend.

```text
User
  │
  ▼
HackMate React App
  │
  ├── Supabase Auth
  │
  ├── Supabase Database
  │
  └── Supabase Edge Function
            │
            ▼
        CometChat
            │
            ▼
     Real-Time Messaging
# Note.js - Modern Notes Application

A full-stack, responsive note-taking application built with React, Node.js, Express, and MongoDB.

## ✨ Key Features

- **Dynamic Theming with Node-Vibrant**: Upload a background image via your profile, and the backend automatically extracts a custom color palette (main, accent, and secondary accent colors) using `node-vibrant`. The frontend then seamlessly applies this custom palette across all UI elements, including gradients, text, buttons, and glow effects, giving every user a personalized experience.
- **Dark & Vibrant Mode**: Toggle between a deeper dark mode and a lighter vibrant mode, dynamically adapting the interface and background overlay to match your custom color palette and mood.
- **Auto Save**: Notes are automatically saved as you type, so you never lose your train of thought.
- **Mobile-Optimized UI**: The application is fully responsive and tailored for all devices (phones, tablets, and desktops).
  - Features a smooth, collapsible **Hamburger Menu** for navigation on smaller screens.
  - **Adaptive Grid Layouts**: Notes reorganize beautifully depending on your screen size.
  - **Touch-Friendly**: Generous padding, tap targets, and optimized spacing for mobile users.
- **Glassmorphism Aesthetics**: A modern UI design featuring translucent components, backdrop blurs, and sleek glowing hover shadows.
- **Secure Image Storage**: Profile avatars and backgrounds are uploaded securely using Cloudinary.

## 🤝 Acknowledgements

- Huge shout out to [Rajdeep Das](https://github.com/rajdeepcodeshere247) for the amazing suggestions to implement the auto save functionality and the dark/light mode toggle!

## 🛠️ Tech Stack

- **Frontend:** React, Tailwind CSS, React Router, Lucide React (Icons), Zustand (State Management)
- **Backend:** Node.js, Express, MongoDB (Mongoose), Cloudinary, Node-Vibrant (Color Extraction)

## 🚀 Getting Started

### Prerequisites
- Node.js installed
- MongoDB URI
- Cloudinary Credentials

### Installation

1. **Clone the repository**
2. **Setup Backend:**
   - Navigate to the `backend` folder.
   - Run `npm install`
   - Create a `.env` file with `MONGO_DB_URI` and your Cloudinary credentials.
   - Start the server: `npm run dev`

3. **Setup Frontend:**
   - Navigate to the `frontend` folder.
   - Run `npm install`
   - Start the development server: `npm run dev`

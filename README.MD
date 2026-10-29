# Secure Multi-Factor Authentication (MFA) Framework Using Biometric Verification

A modern, production-ready Full-Stack web application implementing robust Multi-Factor Authentication (MFA) combining traditional password credentials with FIDO2 / WebAuthn passwordless biometric verification (Windows Hello, Touch ID, and hardware security keys).

---

## 🚀 Features

- **Primary Authentication:** Secure user registration and login using hashed credentials (`bcryptjs`) and JSON Web Tokens (JWT).
- **Biometric MFA (WebAuthn / FIDO2):** Passwordless secondary verification supporting platform authenticators like Windows Hello, Touch ID, and external security keys.
- **Security Dashboard:** Live session state monitoring, linked biometric authenticator counts, and device enrollment management.
- **Audit Logging:** Real-time logging of authentication attempts, registration events, and security status updates.
- **Modern UI & Stack:** Built with a clean, responsive dark-themed interface using Tailwind CSS and Lucide icons.

---

## 🛠️ Tech Stack

### **Frontend**
* React (Vite)
* Tailwind CSS
* Lucide React
* `@simplewebauthn/browser`

### **Backend**
* Node.js & Express.js
* MongoDB & Mongoose
* `@simplewebauthn/server`
* JSON Web Tokens (JWT) & `bcryptjs`

---

## 📁 Project Structure

```text
secure-mfa-biometric/
├── backend/                  # Node.js & Express API server
│   ├── src/
│   │   ├── config/           # Database & environment configurations
│   │   ├── controllers/      # Auth & WebAuthn business logic
│   │   ├── middleware/       # JWT auth guard & logging middleware
│   │   ├── models/           # Mongoose schemas (User, Authenticator, AuditLog)
│   │   ├── routes/           # API router endpoints
│   │   └── server.js         # Entry point
│   ├── .env                  # Environment variables
│   └── package.json
└── frontend/                 # React & Vite client application
    ├── src/
    │   ├── components/       # UI components & views
    │   ├── services/         # Axios API & WebAuthn helper layer
    │   ├── App.jsx           # Main application state & router view
    │   └── main.jsx          # React DOM entry point
    ├── .env                  # Frontend environment configuration
    └── package.json
Here is a complete, professional, and comprehensive `README.md` file tailored for your **Secure Multi-Factor Authentication Framework Using Biometric Verification** project. You can copy this directly into your repository's root directory as `README.md`.

---

```markdown
# Secure Multi-Factor Authentication (MFA) Framework Using Biometric Verification

A modern, production-ready Full-Stack web application implementing robust Multi-Factor Authentication (MFA) combining traditional password credentials with FIDO2 / WebAuthn passwordless biometric verification (Windows Hello, Touch ID, and hardware security keys).

---

## 🚀 Features

- **Primary Authentication:** Secure user registration and login using hashed credentials (`bcryptjs`) and JSON Web Tokens (JWT).
- **Biometric MFA (WebAuthn / FIDO2):** Passwordless secondary verification supporting platform authenticators like Windows Hello, Touch ID, and external security keys.
- **Security Dashboard:** Live session state monitoring, linked biometric authenticator counts, and device enrollment management.
- **Audit Logging:** Real-time logging of authentication attempts, registration events, and security status updates.
- **Modern UI & Stack:** Built with a clean, responsive dark-themed interface using Tailwind CSS and Lucide icons.

---

## 🛠️ Tech Stack

### **Frontend**
* React (Vite)
* Tailwind CSS
* Lucide React
* `@simplewebauthn/browser`

### **Backend**
* Node.js & Express.js
* MongoDB & Mongoose
* `@simplewebauthn/server`
* JSON Web Tokens (JWT) & `bcryptjs`

---

## 📁 Project Structure

```text
secure-mfa-biometric/
├── backend/                  # Node.js & Express API server
│   ├── src/
│   │   ├── config/           # Database & environment configurations
│   │   ├── controllers/      # Auth & WebAuthn business logic
│   │   ├── middleware/       # JWT auth guard & logging middleware
│   │   ├── models/           # Mongoose schemas (User, Authenticator, AuditLog)
│   │   ├── routes/           # API router endpoints
│   │   └── server.js         # Entry point
│   ├── .env                  # Environment variables
│   └── package.json
└── frontend/                 # React & Vite client application
    ├── src/
    │   ├── components/       # UI components & views
    │   ├── services/         # Axios API & WebAuthn helper layer
    │   ├── App.jsx           # Main application state & router view
    │   └── main.jsx          # React DOM entry point
    ├── .env                  # Frontend environment configuration
    └── package.json

```

---

## ⚙️ Getting Started & Installation

### Prerequisites

* Node.js (v18+ recommended)
* MongoDB (running locally or via MongoDB Atlas)

### 1. Clone the Repository

```bash
git clone [https://github.com/rashigarg04/Secure_Multifactor_authentication_framework_using_biometric_verifications.git](https://github.com/rashigarg04/Secure_Multifactor_authentication_framework_using_biometric_verifications.git)
cd secure-mfa-biometric

```

### 2. Backend Setup

Navigate to the backend directory, install dependencies, and configure your environment:

```bash
cd backend
npm install

```

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/secure-mfa-db
JWT_SECRET=a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8

```

Start the backend server:

```bash
npm run dev

```

### 3. Frontend Setup

Open a new terminal window, navigate to the frontend directory, install dependencies, and start the client:

```bash
cd frontend
npm install

```

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_URL=http://localhost:5000/api

```

Start the frontend development server:

```bash
npm run dev

```

Open your browser at `http://localhost:5173` to interact with the application.

---

## 🔒 Security & WebAuthn Configuration Notes

* **Localhost Testing:** WebAuthn relies on secure contexts (`https` or `localhost`). Testing on `http://localhost:5173` is fully supported by modern browsers for platform authenticators.
* **Credential Storage:** Raw biometric data never leaves your hardware device. Only cryptographic public keys and metadata are stored in the MongoDB backend database.

---

## 👩‍💻 Author

* **Rashi Garg**
* B.Tech Computer Science and Engineering — IILM University

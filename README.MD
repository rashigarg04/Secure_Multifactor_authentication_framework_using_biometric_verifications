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

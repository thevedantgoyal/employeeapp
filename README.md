# Employee App

## Project Overview

Employee App is a full-stack web application built to manage employee-related operations efficiently.
It includes a modern frontend built with React and a backend API built with Node.js connected to a PostgreSQL database.

---

## Project Setup

### 1. Clone the Repository

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
```

---

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

---

### 3. Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend will start on (configured in Vite):

```
http://localhost:3000
```

---

## Backend Setup

The frontend communicates with a **Node.js backend** that uses **PostgreSQL** as the database.

### 1. Navigate to Backend

```bash
cd backend
```

### 2. Setup Environment Variables

```bash
cp .env.example .env
```

Edit the `.env` file and configure your PostgreSQL database connection:

```
DATABASE_URL=postgresql://user:password@localhost:5432/yourdb
```

---

### 3. Install Backend Dependencies

```bash
npm install
```

---

### 4. Run Database Migrations

```bash
npm run migrate
```

This will create the required database tables.

---

### 5. Start Backend Server

```bash
npm run dev
```

Backend will run on:

```
http://localhost:4000
```

---

## Frontend Environment Variables

Create a `.env` file in the `frontend` directory:

```
VITE_API_URL=http://localhost:4000/api
```

If this variable is not set, the application will automatically use the default API URL.

---

## Running the Full Application

Run both frontend and backend simultaneously.

**Terminal 1**

```bash
cd backend
npm run dev
```

**Terminal 2**

```bash
cd frontend
npm run dev
```

---



### Database

* PostgreSQL

---

## Features

* Employee management system
* Modern responsive UI
* RESTful API architecture
* PostgreSQL database integration
* Full-stack TypeScript support

---

## Project Structure

```
project-root
│
├── backend          # Node.js API
├── frontend         # Vite React app
│   ├── src          # React frontend source
│   └── public       # Static assets
├── docs             # Documentation
└── README.md
```

---

## License

This project is for learning and development purposes.

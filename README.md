# 🎓 Smart School Management System (Enterprise Edition)

[![Production Web](https://img.shields.io/badge/Live%20Web-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://demoprivatesmartschool.vercel.app)
[![Production API](https://img.shields.io/badge/Live%20API-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://shmool.onrender.com)
[![Mobile App](https://img.shields.io/badge/Mobile-Android%20APK-3DDC84?style=for-the-badge&logo=android&logoColor=white)](#-mobile-application-android)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2F%20Express-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/Product-Commercial%20SaaS-gold?style=for-the-badge)]()

An end-to-end, multi-tenant enterprise School Management System (SMS) engineered for private educational institutions, school networks, and academies. Built with Next.js 14, Node.js, PostgreSQL, and Capacitor, featuring a family-based fee calculation engine, multi-role RBAC, real-time analytics, automated data backups, and native Android app integration.

---

## 🌟 Live Production Links & Demos

| Platform | Link / Details | Credentials / Status |
| :--- | :--- | :--- |
| 🌐 **Live Web Application (Vercel)** | [https://demoprivatesmartschool.vercel.app](https://demoprivatesmartschool.vercel.app) | Production Deployment ✅ |
| ⚡ **Live Backend API (Render)** | [https://shmool.onrender.com](https://shmool.onrender.com) | Health Check: `/api/system/health` ✅ |
| 📱 **Android App (APK Build)** | Built via Capacitor in `client/android [D_P_School]` | Standalone Package ID: `com.demosmartschool.app` |
| 🔑 **Default Admin Login** | Username: `root` \| Password: `root123` | Full System Access |

---

## 📋 Table of Contents

- [🌟 Live Production Links & Demos](#-live-production-links--demos)
- [✨ Product Overview & Highlights](#-product-overview--highlights)
- [👥 Multi-Role Shared Portal Architecture](#-multi-role-shared-portal-architecture)
- [🏛️ Detailed Core Modules](#️-detailed-core-modules)
  - [1. 👨‍🎓 Student Management & Lifecycle](#1-student-management--lifecycle)
  - [2. 👨‍👩‍👧‍👦 Family & Sibling Engine](#2-family--sibling-engine)
  - [3. 💰 Advanced Family Fee & Financial Engine](#3-advanced-family-fee--financial-engine)
  - [4. 🎓 Academic & Class Management](#4-academic--class-management)
  - [5. 📅 Attendance Tracking System](#5-attendance-tracking-system)
  - [6. 📝 Examination, Marks & Result System](#6-examination-marks--result-system)
  - [7. 💳 Expense & Financial Management](#7-expense--financial-management)
  - [8. 👔 Human Resource Management (HRM)](#8-human-resource-management-hrm)
  - [9. 📈 Reports & Business Intelligence](#9-reports--business-intelligence)
  - [10. 🔐 Role-Based Access Control (RBAC)](#10-role-based-access-control-rbac)
  - [11. ⚙️ School & System Configuration](#11-school--system-configuration)
  - [12. 🛡️ Backup, Security & System Health](#12-backup-security--system-health)
- [📱 Mobile Application (Android / Capacitor)](#-mobile-application-android--capacitor)
- [🛠️ Technology Stack](#️-technology-stack)
- [🚀 Local Setup & Operating Guide](#-local-setup--operating-guide)
- [🌐 Cloud Deployment Guide (Vercel + Render)](#-cloud-deployment-guide-vercel--render)
- [📂 Project File Structure](#-project-file-structure)
- [📚 Deep-Dive Documentation Index](#-deep-dive-documentation-index)

---

## ✨ Product Overview & Highlights

Smart School Management System is designed to automate complete school operations from student admissions to financial audits and examination report cards.

### Key Value Propositions
- 💳 **Family-Aware Billing Engine**: Combines tuition fees for all siblings into single family vouchers with blood/cousin discount rules and automated payment waterfalls.
- 🔐 **Unified Single-Portal Architecture**: A single web portal automatically adapts its interface, sidebars, and dashboards based on user role level (Admin, Principal, Teacher, Accountant, Student/Parent).
- 📊 **Real-Time Visual Analytics**: Dynamic dashboards powered by Recharts providing instant insights into fee collections, pending dues, monthly expenses, and student attendance.
- 📱 **Mobile Native Integration**: Built-in Capacitor Android project ready for compilation into standalone Android APKs.
- 💾 **Automated Zero-Data-Loss Backups**: Built-in automated database backups, SQL export, import restore, and health diagnostics.
- 📑 **Print-Ready Documents**: Auto-generated family fee vouchers, individual fee receipts, admission forms, result cards, and marks sheets formatted for thermal and standard A4 printers.

---

## 👥 Multi-Role Shared Portal Architecture

The platform implements a **Dynamic Access Control System**. All users log in through a single entry point (`/login`), and the system dynamically resolves their dashboard layout, sidebar navigation, and actionable permissions:

```mermaid
graph TD
    A[User Login /auth] --> B{Role Level Check}
    B -->|Role Level >= 90| C[Admin / Principal Dashboard]
    B -->|Role Level 50 - 89| D[Teacher Dashboard]
    B -->|Role Level 30 - 49| E[Accountant Dashboard]
    B -->|Role Level < 30| F[Student / Parent Portal]
    
    C --> G[Full System Control & Settings]
    D --> H[Class Attendance & Marks Entry]
    E --> I[Fee Collection & Expense Ledger]
    F --> J[Personal Profile & Result Cards]
```

### Supported User Roles
1. **Administrator / Principal (`Level 90+`)**: Full access to all modules, financial reporting, system settings, user management, and DB backups.
2. **Teacher (`Level 50 - 89`)**: Academic management, student mark entry, class attendance marking, and assigned subject views.
3. **Accountant / Cashier (`Level 30 - 49`)**: Fee slip generation, fee collection, admission fee ledgers, exam fee collection, and expense tracking.
4. **Student / Parent Portal (`Level < 30`)**: Profile overview, fee payment history, result cards, attendance record, and school notices.
5. **Custom Roles**: Unlimited custom roles (e.g., Coordinator, Vice Principal, Hostel Warden) with custom permission matrices.

---

## 🏛️ Detailed Core Modules

### 1. 👨‍🎓 Student Management & Lifecycle
- **New Student Admission**: Comprehensive form capturing personal details, guardian contact, academic class/section allocation, and custom fee structures.
- **Auto Student Credential Generation**: Automatically creates a matching user login account (`STU-XXXX`) upon admission.
- **Bulk Excel Import**: Built-in parser (`xlsx`) to import hundreds of student records from Excel templates in seconds.
- **Student Profile Management**: Complete student profiles with avatar uploads, quick info cards, verified badges, and quick edit capabilities.
- **Advanced Search & Filtering**: Instant search by admission number, student name, father name, roll number, class, or section.
- **Student Status Controls**: Easily mark students as Active, Inactive, Promoted, Graduated, or Struck Off.

### 2. 👨‍👩‍👧‍👦 Family & Sibling Engine
- **Automated Family ID (`FAM-YYYY-NNNN`)**: Automatically groups children belonging to the same family during admission or via manual linking.
- **Sibling Relationship Tracking**: Distinguishes between **Blood Siblings** and **Cousin Siblings** with auto-filled parent/guardian details.
- **Family Merging Tool**: Merge duplicate family records without losing fee history or student profiles.
- **Shared Family Contact Info**: Update parent phone number or address once, and it updates across all linked siblings instantly.

### 3. 💰 Advanced Family Fee & Financial Engine
- **Configurable Fee Heads**: Unlimited fee heads (Tuition Fee, Admission Fee, Transport Fee, Exam Fee, Generator/Utility Fee, Computer Lab, Fine, Previous Balance).
- **Class-Wise Fee Plans**: Define fee structures per class or custom student plan.
- **Monthly Fee Slip Generation**: Single-click batch generation of monthly fee slips for entire classes or selected students.
- **Family Fee Vouchers**: Merges tuition fees for all siblings into a single **Family Voucher**, showing individual breakdowns and family totals.
- **Payment Waterfall Engine**: Received payments automatically clear dues in order:
  1. Family Opening Balance (OPB)
  2. Oldest Unpaid Monthly Slips
  3. Current Month Fees
- **Partial & Advance Payments**: Full support for partial fee collections with automatic remaining balance tracking.
- **Admission Fee Ledger**: Dedicated ledger for admission fee installments, initial discounts, and custom payment schedules.
- **Exam Fee Collection**: Separate module for exam fee dues collection and tracking.
- **Print Queue & Receipt Voucher Printing**: Thermal/A4 print support for family fee slips and payment receipts with printed-state tracking.
- **Payment Reversal & Reconcile**: Revert accidental or incorrect fee postings while preserving audit integrity.

### 4. 🎓 Academic & Class Management
- **Class & Section Setup**: Flexible hierarchy for configuring classes (e.g., Nursery to Grade 10) and multiple sections (A, B, C).
- **Subject Management**: Subject allocation per class (Theory, Practical, Marks weightage).
- **Teacher Assignments**: Map teachers as Class Incharges or Subject Teachers for specific classes.
- **Class Promotion Workflow**: Bulk promotion engine to transition eligible students from one academic session/class to the next.

### 5. 📅 Attendance Tracking System
- **Student Attendance**: Daily attendance marking by Class Teacher (Present, Absent, Late, Leave).
- **Staff Attendance**: Daily check-in / check-out tracking for teachers and administrative staff.
- **Attendance History & Trends**: Historical calendar view and monthly percentage breakdown per student/staff.
- **Dashboard Widgets**: Real-time attendance percentage widgets on Admin and Teacher dashboards.

### 6. 📝 Examination, Marks & Result System
- **Exam Term Setup**: First Term, Mid Term, Final Term, and Monthly Class Tests configuration.
- **Marks Entry Workflows**: Subject-wise marks entry with lock/unlock controls to prevent unauthorized changes after submission.
- **Result Card Generation**: Automated generation of printable student result cards with grades, positions, and teacher remarks.
- **Marks Sheet**: Class-wide marks summary sheet for result consolidation.
- **Test Marking Module**: Short test paper marks recording and performance tracking.

### 7. 💳 Expense & Financial Management
- **Expense Categories**: 7 pre-configured default categories (Salaries, Utilities, Maintenance, Supplies, Transport, Marketing, Misc) + custom categories.
- **Expense Entry**: Detailed record keeping with expense title, category, amount, date, vendor name, payment method, and description.
- **Payment Methods**: Cash, Bank Transfer, Cheque, Credit Card, Online Payment.
- **Financial Summaries**: Real-time total expense graphs and category breakdown charts.

### 8. 👔 Human Resource Management (HRM)
- **Employee Database**: Complete staff management (Teachers, Admin Staff, Support Staff).
- **Department Management**: Academic, Finance, IT, Administration, Transport departments.
- **App User Linkage**: Link employee profiles to system user accounts for login permissions.

### 9. 📈 Reports & Business Intelligence
- **Admission Reports**: Filterable statistics on new admissions, gender ratios, and class distribution.
- **Student Reports**: Class lists, contact directories, and family group reports.
- **Result Reports**: Subject toppers, pass/fail ratios, and grade distribution charts.
- **Expense Reports**: Date-range filtered expense logs with export options.
- **Family Fee Reports**: Total pending dues, collected fees, and defaulter lists.

### 10. 🔐 Role-Based Access Control (RBAC)
- **Granular Permission Matrix**: Module-by-module `Can Read`, `Can Write`, `Can Delete` controls.
- **Role Manager**: Create custom roles, clone existing roles, and update permissions in real-time.
- **Permission Guard**: Frontend route wrapper ensuring unauthorized users cannot bypass UI links.

### 11. ⚙️ School & System Configuration
- **School Branding**: Custom school name, logo upload, address, contact number, email, and tagline.
- **Academic Calendar & Terms**: Active academic session toggle and term dates.
- **User Account Management**: Create, lock/unlock, reset passwords, and assign roles for all system users.

### 12. 🛡️ Backup, Security & System Health
- **Automated DB Backups**: Scheduled node-cron backups saved directly to local storage or cloud.
- **Manual Backup & Restore**: Download `.sql` database snapshots or restore existing backups from the admin panel.
- **Password Encryption**: Industry-standard `bcryptjs` hashing for all stored credentials.
- **System Health Diagnostics**: `db_health_check.js` script to verify database tables, column structures, and foreign key integrity.

---

## 📱 Mobile Application (Android / Capacitor)

The project includes a ready-to-build **Capacitor 6 Android project** located inside:
`client/android [D_P_School]`

### Mobile App Specifications
- **App Name**: `Demo Private Smart School`
- **Application ID (Package Name)**: `com.demosmartschool.app` *(Unique package ID allowing side-by-side installation with other school apps without replacement)*
- **Capacitor Bridge Package**: `com.demoprivatesmartschool.app`
- **Cleartext Traffic**: Enabled (`android:usesCleartextTraffic="true"`) for smooth API connectivity.
- **Live Sync**: Points to production URL (`https://demoprivatesmartschool.vercel.app`).

### Compiling APK in Android Studio
1. Open Android Studio.
2. Open Project at path: `client/android [D_P_School]`.
3. Select **Build > Clean Project**, then **Build > Rebuild Project**.
4. Select **Build > Build APK(s)** to generate `app-debug.apk` or `app-release.apk`.

---

## 🛠️ Technology Stack

```
Smart School Architecture
├── Frontend (Client)
│   ├── Next.js 14 (App Router)
│   ├── React 18 & TypeScript
│   ├── Bootstrap 5 & Bootstrap Icons
│   ├── Recharts (Data Visualizations)
│   ├── XLSX (Excel Data Parsing)
│   └── Capacitor 6 (Android Mobile Engine)
│
├── Backend (Server)
│   ├── Node.js & Express.js
│   ├── PostgreSQL (pg driver with Connection Pooling)
│   ├── Multer (Media & Document Uploads)
│   ├── Bcryptjs & CORS Middleware
│   └── Node-Cron (Automated Scheduler)
│
└── Deployment Environments
    ├── Web Host: Vercel (Next.js Frontend)
    ├── API Host: Render (Node.js Express Server)
    ├── Cloud DB: PostgreSQL (Supabase / Render Postgres / Neon)
    └── Mobile: Native Android APK
```

---

## 🚀 Local Setup & Operating Guide

### Option 1: Automated 1-Click Batch Setup (Windows)

1. **First Time Setup (Only Once)**:
   Double-click `FIRST_TIME_SETUP.bat` to automatically install all backend and frontend dependencies.

2. **Daily Application Launcher**:
   Double-click `RUN_APP.bat` to launch the interactive menu:
   - **Option 1**: Start Application (Kills old port locks, starts Backend on port `5000`, Frontend on port `3000`, and opens browser automatically).
   - **Option 2**: Stop Application (Gracefully stops all background Node processes).
   - **Option 3**: Restart Application (Clears cache and restarts servers).

---

### Option 2: Manual Developer Setup

#### 1. Backend Setup
```bash
cd server
npm install

# Configure environment variables in server/.env
PORT=5000
DATABASE_URL=postgres://username:password@localhost:5432/demo_school

# Run Database Seeder
node master-seeder.js

# Start Development Server
npm run dev
```

#### 2. Frontend Setup
```bash
cd client
npm install

# Configure environment variables in client/.env.local
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Start Next.js Development Server
npm run dev
```

- **Client App**: `http://localhost:3000`
- **Backend API**: `http://localhost:5000`

---

## 🌐 Cloud Deployment Guide (Vercel + Render)

### 1. Backend Deployment (Render)
- **Repository Subdirectory**: `server`
- **Build Command**: `npm install`
- **Start Command**: `node index.js`
- **Environment Variables**:
  - `PORT`: `5000`
  - `DATABASE_URL`: `postgres://...`
  - `NODE_ENV`: `production`

### 2. Frontend Deployment (Vercel)
- **Repository Subdirectory**: `client`
- **Framework Preset**: Next.js
- **Environment Variables**:
  - `NEXT_PUBLIC_API_URL`: `https://shmool.onrender.com/api`

---

## 📂 Project File Structure

```
Demo_Private_School/
├── RUN_APP.bat                      ⭐ 1-Click Launch Menu for Windows
├── FIRST_TIME_SETUP.bat             ⭐ 1-Click Dependency Installer
├── README.md                        📖 Project Documentation (This File)
├── SOFTWARE_TESTING_CHECKLIST.md    🧪 Comprehensive QA & Testing Manual
│
├── client/                          📁 Frontend Next.js Application
│   ├── app/                         🌐 Next.js 14 App Router Pages
│   │   ├── academic/                🎓 Classes, Sections, Subjects, Teachers
│   │   ├── attendance/              📅 Student & Staff Attendance
│   │   ├── examination/             📝 Exam Marks, Result Cards, Sheets
│   │   ├── expenses/                💳 Expense Log & Categories
│   │   ├── fees/                    💰 Fee Slips, Print Queue, OPB, Ledger
│   │   ├── hrm/                     👔 Staff & Department Management
│   │   ├── reports/                 📊 Analytical System Reports
│   │   ├── settings/                ⚙️ School Configuration & RBAC
│   │   ├── students/                👨‍🎓 Admission, Profiles, Import
│   │   └── page.tsx                 🏠 Dynamic Role-Based Dashboard Entry
│   ├── android [D_P_School]/        📱 Capacitor Android Project & APK Source
│   ├── components/                  🧩 Shared React Components & Dashboards
│   ├── contexts/                    🔐 AuthContext & Permission Handlers
│   ├── capacitor.config.ts          ⚡ Capacitor App Configuration
│   └── public/                      🖼️ Static Assets & Manifest
│
├── server/                          📁 Backend Node.js Express API
│   ├── routes/                      🔌 22+ API Route Handlers
│   ├── master-seeder.js             🌱 Complete DB Seeder & Schema Initializer
│   ├── db.js                        🗄️ PostgreSQL Database Connection Pool
│   ├── migrations.js                🔄 Schema Migration Engine
│   ├── db_health_check.js           🩺 Database Integrity Inspector
│   └── index.js                     🚀 Main Express Server Application
│
└── doc/                             📚 Comprehensive Technical Documentation
    ├── CLIENT_MODULES_AND_PAGES.md
    ├── SERVER_API_AND_MODULES.md
    ├── FEATURES_AND_WORKFLOWS_COMPLETE.md
    ├── FAMILY_FEE_SYSTEM_IMPLEMENTATION.md
    ├── FAMILY_SIBLING_SYSTEM.md
    ├── MULTIUSER_SHARED_PORTAL_SYSTEM.md
    ├── SYSTEM_DETAILED_ARCHITECTURE.md
    └── PROJECT_OVERVIEW.md
```

---

## 📚 Deep-Dive Documentation Index

For in-depth technical references, consult the dedicated guides inside the `doc/` directory:

- 📄 [PROJECT_OVERVIEW.md](file:///d:/peronal/Demo_Private_School/doc/PROJECT_OVERVIEW.md) — System Architecture & Feature Checklist
- 📄 [CLIENT_MODULES_AND_PAGES.md](file:///d:/peronal/Demo_Private_School/doc/CLIENT_MODULES_AND_PAGES.md) — Frontend App Router Navigation & Page Specs
- 📄 [SERVER_API_AND_MODULES.md](file:///d:/peronal/Demo_Private_School/doc/SERVER_API_AND_MODULES.md) — REST API Endpoints & Route Definitions
- 📄 [FEATURES_AND_WORKFLOWS_COMPLETE.md](file:///d:/peronal/Demo_Private_School/doc/FEATURES_AND_WORKFLOWS_COMPLETE.md) — Complete User Journey & Business Workflows
- 📄 [FAMILY_FEE_SYSTEM_IMPLEMENTATION.md](file:///d:/peronal/Demo_Private_School/doc/FAMILY_FEE_SYSTEM_IMPLEMENTATION.md) — Deep-dive into Family Billing & Waterfall Payment Engine
- 📄 [MULTIUSER_SHARED_PORTAL_SYSTEM.md](file:///d:/peronal/Demo_Private_School/doc/MULTIUSER_SHARED_PORTAL_SYSTEM.md) — Single-Portal RBAC Architecture & Dynamic UI Routing
- 📄 [SOFTWARE_TESTING_CHECKLIST.md](file:///d:/peronal/Demo_Private_School/SOFTWARE_TESTING_CHECKLIST.md) — QA Audit & Database Column Integrity Checklist

---

## 💼 Commercial Product Information

- **Product Name**: Smart School Management System (Enterprise Edition)
- **Version**: `2.5.0`
- **Target Market**: Private Schools, Academy Networks, Colleges, Educational Franchises
- **License**: Commercial SaaS Product (Proprietary)
- **Status**: ✅ **100% Production Ready**

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started
# 💈 Barbershop Appointment Booking System

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![React](https://img.shields.io/badge/React-18-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Tailwind](https://img.shields.io/badge/TailwindCSS-UI-38BDF8)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)

A modern **full-stack appointment booking platform** designed for barbershops and service-based businesses.

Customers can book services online while staff manage appointments through a **mobile-friendly admin dashboard**.

The system includes a **custom scheduling engine** that dynamically generates available slots while preventing booking conflicts.

---

# 🌐 Live Demo

https://mancavefamagusta.com

---

# 🚀 Tech Stack

### Frontend

* Next.js (App Router)
* React
* TailwindCSS

### Backend

* Next.js API Routes
* Serverless Functions

### Database

* Supabase
* PostgreSQL

### Deployment

* Vercel

### Integrations

* Telegram Bot API
* WhatsApp Deep Links
* Google Calendar
* ICS Calendar Export

---

# ✨ Features

### Customer Side

* Online appointment booking
* Real-time slot availability
* Multi-service booking
* Calendar export
* WhatsApp confirmation flow
* Mobile-first responsive UI

### Admin Panel

* Appointment management
* Manual appointment creation
* Status updates
* Payment confirmation (deposit system)
* Mobile admin interface

### Messaging

* Telegram notifications for new bookings
* WhatsApp deep-link messaging

---

# 🧠 Scheduling Engine

The system includes a custom-built scheduling engine that handles:

* dynamic slot generation
* appointment overlap detection
* service duration calculation
* barber capacity management
* multi-service scheduling

Core utilities include:

```
buildSegments()
overlaps()
resourceFor()
sortServices()
```

This logic ensures appointments never conflict and resources are allocated correctly.

---

# 🗄 Database Structure

Supabase PostgreSQL tables:

```
appointments
appointment_services
services
barbers
service_options
capacity_settings
```

Features used:

* relational queries
* auth cookies
* service role
* realtime capabilities

---

# 📡 API Routes

Example API endpoints:

```
/api/appointments
/api/availability
/api/admin/appointments
/api/admin/manual-appointment
/api/appointment-ics
```

Used for:

* booking creation
* slot availability
* admin operations
* calendar export

---

# 🏗 Architecture

```
Customer UI
   ↓
Next.js Frontend
   ↓
API Routes (Serverless)
   ↓
Supabase PostgreSQL
   ↓
Messaging Integrations
(Telegram / WhatsApp)
```

Deployment handled by **Vercel**.

---

# 📅 Calendar Integration

Customers can add appointments to their calendar using:

* Google Calendar link
* ICS file download

Example endpoint:

```
/api/appointment-ics
```

---

# 💳 Payment Flow

Deposit-based booking flow:

1. Customer creates appointment
2. WhatsApp deposit instructions sent
3. Admin confirms payment
4. Appointment status → `paid`

---

# 💡 Potential SaaS Expansion

The architecture can easily evolve into a **multi-tenant SaaS platform** for service-based businesses such as:

* barbershops
* salons
* nail studios
* tattoo studios
* clinics

Future SaaS features could include:

* multi-location support
* subscription billing
* automated reminders
* analytics dashboard

---

# 👨‍💻 Author

Built with:

Next.js • React • TailwindCSS • Supabase • Vercel

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Jobtrail

A job application tracker. Drag applications between Applied, Interview, Offer and Rejected, and see your whole pipeline at a glance.

**Stack:** HTML, CSS, vanilla JavaScript (front end) · Node.js + Express REST API returning JSON · MySQL · bcrypt + JWT login

## Features
- Sign up and log in (passwords hashed with bcrypt, sessions via JWT)
- Add, edit, delete applications with company, role, link, date and notes
- Drag and drop between stages, with search and a pipeline summary bar
- Dark mode and mobile friendly

## Run locally
1. Install Node 18+ and MySQL, then create a database: `CREATE DATABASE jobtrail;`
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your MySQL details
4. `npm start`, then open http://localhost:3000 (tables are created automatically)

## API
| Method | Route | Purpose |
|---|---|---|
| POST | /api/register, /api/login | Get a token |
| GET | /api/applications | List your applications |
| POST | /api/applications | Create one |
| PUT | /api/applications/:id | Update one |
| DELETE | /api/applications/:id | Delete one |

Live demo: https://jobtrail-cwsx.onrender.com/

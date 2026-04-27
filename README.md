# Notes App

A full-stack, secure note-taking application built with Node.js, Express, PostgreSQL, and EJS. It features robust user authentication using Passport.js, supporting both local email/password login and Google OAuth2 integration.

🚀 **Live Demo:** [https://www.notejs.in/](https://www.notejs.in/)

## Features

- **User Authentication:** 
  - Email format validation and OTP-based email verification via Resend.
  - Local strategy (Email & Password) with `bcrypt` password hashing.
  - Google OAuth2 integration for seamless login.
- **Session Management:** Secure, persistent sessions stored in PostgreSQL using `connect-pg-simple`.
- **Note Management (CRUD):**
  - Create new notes with titles and content.
  - Read/View existing notes.
  - Update notes securely.
  - Delete notes.
- **Search Functionality:** Search through notes by title or content.
- **Responsive Views:** Server-side rendered views using EJS.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL (`pg`)
- **Authentication:** Passport.js (`passport-local`, `passport-google-oauth2`)
- **Templating:** EJS
- **Session Store:** `connect-pg-simple`
- **Other Tools:** `bcrypt`, `dotenv`, `body-parser`, `resend`, `email-validator`

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/banerjee2080/Notes_app.git
   cd Notes_app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL Database**
   - Create a database in PostgreSQL.
   - Run the schema creation script to set up the required tables:
     ```sql
     -- Create Users table
     CREATE TABLE users (
         id SERIAL PRIMARY KEY,
         email TEXT UNIQUE NOT NULL,
         password TEXT,
         name TEXT,           
         picture TEXT
     );

     -- Create Notes table
     CREATE TABLE notes (
         id SERIAL PRIMARY KEY,
         title TEXT NOT NULL,
         note TEXT NOT NULL,
         user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
     );

     -- The 'session' table will also be required by connect-pg-simple
     CREATE TABLE "session" (
       "sid" varchar NOT NULL COLLATE "default",
       "sess" json NOT NULL,
       "expire" timestamp(6) NOT NULL
     )
     WITH (OIDS=FALSE);
     ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
     CREATE INDEX "IDX_session_expire" ON "session" ("expire");
     ```
   Alternatively, you can just use the provided `queries.sql` file for the users and notes tables.

4. **Environment Variables**
   Create a `.env` file in the root directory and add the following:
   ```env
   DATABASE_URL=your_postgresql_connection_string
   SESSION_SECRET=your_secret_key_for_sessions
   RESEND_API_KEY=your_resend_api_key
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   PORT=3000
   ```

5. **Start the application**
   ```bash
   npm run dev
   # or
   node index.js
   ```

6. **View in Browser**
   Open [http://localhost:3000](http://localhost:3000)

## Project Structure

- `index.js`: Main application entry point and route definitions.
- `views/`: EJS templates (`home.ejs`, `login.ejs`, `register.ejs`, `notes.ejs`, `note.ejs`, etc.).
- `public/`: Static assets (CSS, client-side JS, images).
- `queries.sql`: SQL queries for database schema creation.

## License

ISC License

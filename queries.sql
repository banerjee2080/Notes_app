DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS users;

-- 1. Create the Users table first (since Notes depends on it)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    name TEXT,           
    picture TEXT
);

-- 2. Create the Notes table
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    note TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);
--creating the users table--
create table users(
    id serial primary key,
    email text,
    password text
);
--Creating the notes table--
create table notes(
    id serial primary key,
    note text,
    user_id integer references users(id)
);
# Chit-Chat Server

> BackEnd server for Chit-Chat messaging app. Refer: https://github.com/regex5440/chit-chat

## BackEnd Stack

- Node.Js + Express.Js
- MongoDB
- Socket.io
- JWT

## Node Version

> `v18.14.0`

## Environment

> Create a `.env` file in the root directory and set the following variables:

```
DB_UserName=<MONGODB_USERNAME>
DB_PassWord=<MONGODB_PASSWORD>
TOKEN_KEY=<YOUR KEY FOR JWT SIGNATURE>
```

> Replace the `<---HINT---->` with your own values.

## Available Script

`npm start`

> Start the server using nodemon and watch for changes

`npm run static`

> Start the server script without watching file changes.

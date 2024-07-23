# Chit-Chat Server

> BackEnd server for Chit-Chat messaging app. Refer: https://github.com/regex5440/chit-chat

## BackEnd Stack

- Node.Js + Express.Js
- MongoDB
- Socket.io
- JWT

## Node Version

> \>= `v18.14.0`

## Environment

> Create a `.env` file in the root directory and set the following variables:

```
App_Logo=<Link to the logo image>
Client_URL=<Origin domain of frontend app>
DB_UserName=<MONGODB_USERNAME>
DB_PassWord=<MONGODB_PASSWORD>
TOKEN_KEY=<YOUR KEY FOR JWT SIGNATURE>
SIGNUP_TOKEN_KEY=<YOUR KEY FOR JWT SIGNATURE (Same or different from TOKEN_KEY)>
EMAIL_SERVICE_URL=<URL to be used for mailing>
EMAIL_SERVICE_TOKEN=<Authentication token for mailing service>
AWS_Endpoint=<AWS Endpoint URL (including account id)>
AWS_Access_KeyID=<TOKEN ACCESS ID>
AWS_SecretAccess_Key=<TOKEN SECRET ACCESS KEY>
S3_ProfileData_Bucket=<Bucket name for profile pictures>
S3_Assets_Bucket=<Bucket name for attachments>
OAuth_ID=<OAuth ID from OAuth Provider>
OAuth_Key=<OAuth Key from OAuth Provider>
Redis_Password=<Redis Cloud DB password>
WORKER_LIMIT=<Number to limit the clusters>
EMAIL_ALERT_TO=<Optional email address to send updates for service down>
```

> Replace the `<---HINT---->` with your own values.

## Available Script

### Development
`npm start`
> Start the server using nodemon and watch for changes

### Production
`npm run build`
> Build to ./build directory

`npm run static`
> Start the server script without watching file changes.

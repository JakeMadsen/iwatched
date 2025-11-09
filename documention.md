# iWatched

iWatched is a web application for tracking movies and TV shows you have watched. It provides a user-friendly interface to log, review, and manage your watched content.

## Features

- User authentication and session management
- Add, edit, and delete movies or TV shows from your watched list
- Search and filter your watched content
- Rate and review movies or shows
- Responsive web interface

## Project Structure

```
bin/
  server/                # Server entry point and configuration
    config/              # Server settings (e.g., serverSettings.json)
db/
  models/                # Database models (e.g., User, Movie)
  helpers/               # Database helper functions
public/                  # Static assets (CSS, JS, images)
routes/
  controllers/           # Route handlers/controllers
  services/              # Business logic/services
views/                   # EJS templates for rendering pages
documention.md           # Project documentation
```

## Configuration

- Server settings are in `bin/server/config/serverSettings.json`
- MongoDB connection string is stored in the configuration file

## Getting Started

1. **Install dependencies:**
   ```
   npm install
   ```

2. **Configure environment:**
   - Update `bin/server/config/serverSettings.json` with your server and MongoDB details if needed.

3. **Run the server:**
   ```
   npm start
   ```
   The server will start on the port specified in `serverSettings.json` (default: 3001).

4. **Access the app:**
   - Open your browser and go to `http://localhost:3001`

## Scripts

- `npm start` — Start the server
- `npm test` — Run tests (if available)

## Technologies Used

- Node.js
- Express.js
- MongoDB (Mongoose)
- EJS (Embedded JavaScript templates)
- JavaScript, HTML, CSS

## Dependencies

- `aws-sdk` - SDK for interacting with AWS services (e.g., S3). Used for storing and migrating profile images and other assets.
- `axios` - Promise-based HTTP client used to call external APIs (e.g., TMDB) from the server and scripts.
- `bcrypt-nodejs` - Password hashing for user credentials (local authentication).
- `connect-flash` - Flash message middleware for Express, to show one-time notifications (e.g., login errors, status messages).
- `connect-mongo` - MongoDB-backed store for `express-session`, persisting sessions in the database.
- `cookie-parser` - Parses cookies attached to incoming requests for use in routes and middleware.
- `dotenv` - Loads environment variables from a `.env` file into `process.env` for configuration.
- `ejs` - Template engine used to render server-side HTML views in `views/`.
- `express` - Web framework that powers routing, middleware, and HTTP handling.
- `express-fileupload` - Middleware to handle file uploads (e.g., profile images or other user uploads).
- `express-session` - Session management for authentication and per-user state.
- `file-type` - Detects file type (mime/extension) from file buffers for validation and safety checks.
- `geoip-lite` - IP geolocation lookups (e.g., for analytics, moderation, or fraud checks).
- `hat` - Simple unique ID/token generator for ephemeral identifiers.
- `http-errors` - Utility to create HTTP-friendly error objects for consistent error handling.
- `ip` - Utilities for retrieving and working with IP addresses.
- `method-override` - Allows HTTP verbs like PUT/DELETE via query or header override (HTML forms compatibility).
- `moment` - Date/time utilities for formatting and manipulation across the app.
- `mongodb` - Official MongoDB driver (low-level). Used alongside Mongoose in some utilities.
- `mongoose` - ODM for MongoDB models used in `db/models/*`.
- `morgan` - HTTP request logging middleware for Express.
- `moviedb-promise` - Promise-based client for The Movie Database (TMDB) API used by scripts and data fetches.
- `nodemon` - Development tool that auto-restarts the server on code changes (`npm run start-live`).
- `passport` - Authentication middleware framework for Express.
- `passport-facebook` - Facebook OAuth strategy for Passport (social login).
- `passport-local` - Username/password strategy for Passport (local login).
- `password-generator` - Utility to generate random passwords (see `db/helpers/passwordGenerator.js`).
- `portfinder` - Finds an open port when starting services (useful for local/dev environments).
- `sharp` - High-performance image processing (resize, crop, convert) for uploaded images and thumbnails.
- `socket.io` - Real-time bidirectional communication (e.g., notifications, live updates).
- `twilio` - Client for Twilio APIs for SMS or messaging features.
- `vanilla-cookieconsent` - Front-end cookie consent banner for compliance and UX.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/YourFeature`)
5. Create a new Pull Request

## License

This project is licensed under the MIT License.

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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/YourFeature`)
5. Create a new Pull Request

## License

This project is licensed under the MIT License.

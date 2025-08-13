# AG-URL Shortener API

![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?style=for-the-badge&logo=socket.io&logoColor=white)

A robust, real-time URL shortening API built with Express.js, MongoDB, and Socket.IO. This backend service provides comprehensive URL shortening capabilities with real-time updates, click tracking, and efficient caching mechanisms for optimal performance.

## Core Features

**URL Shortening Service** - Generate unique shortened URLs with custom codes using ShortID library for optimal collision resistance and URL-safe character generation.

**Real-Time Communication** - Implement bidirectional real-time updates using Socket.IO, ensuring instant synchronization across all connected clients without page refreshes.

**Advanced Click Tracking** - Monitor URL performance with real-time click analytics that update across all connected clients instantly upon URL access.

**Intelligent Caching** - Dual-layer caching system with in-memory storage for both URL lookup and redirect operations, significantly improving response times.

**Database Persistence** - Secure MongoDB integration with connection retry mechanisms and data validation using Mongoose ODM for reliable data storage.

**CORS-Enabled API** - Cross-Origin Resource Sharing configuration allowing seamless integration with frontend applications from any domain.

**Auto-Retry Connection** - Built-in MongoDB connection retry logic with exponential backoff to ensure robust database connectivity.

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|----------|
| Node.js | 18.x | Runtime environment for server-side JavaScript |
| Express | 4.x | Web application framework for API routing |
| MongoDB | 7.x | NoSQL database for URL data persistence |
| Socket.IO | 4.x | Real-time bidirectional event-based communication |
| Mongoose | 7.x | MongoDB object modeling with built-in validation |
| ShortID | Latest | URL-safe unique ID generation for short codes |
| CORS | Latest | Cross-origin resource sharing middleware |

## Quick Start

### Prerequisites

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/badge/npm-Latest-CB3837?style=flat-square&logo=npm&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7%2B-47A248?style=flat-square&logo=mongodb&logoColor=white)

### Installation

```bash
# Clone the repository
git clone https://github.com/aaditya09750/urlshortenerApi.git
cd urlshortenerApi

# Install dependencies
npm install

# Configure environment (optional)
# Create .env file for custom configurations
echo "PORT=3002" > .env
echo "MONGODB_URI=your_mongodb_connection_string" > .env
```

### Configuration

The API uses MongoDB Atlas by default. For local development:

```javascript
// Update connection string in index.js
mongoose.connect('mongodb://localhost:27017/url-shortner', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
```

### Running the Application

```bash
# Start the server
npm start

# For development with auto-reload
npm run dev  # if nodemon is configured

# Server will be available at:
# API: http://localhost:3002
# Socket.IO: ws://localhost:3002
```

## API Documentation

### REST Endpoints

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/shorten` | POST | Create shortened URL | `{"url": "https://example.com"}` | URL object with short code |
| `/api/urls` | GET | Retrieve all URLs | None | Array of URL objects |
| `/api/urls/:id` | DELETE | Delete specific URL | None | Success confirmation |
| `/:code` | GET | Redirect to original URL | None | HTTP redirect (302) |

### Request/Response Examples

**Create Short URL**
```bash
curl -X POST http://localhost:3002/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**Response:**
```json
{
  "_id": "64a1b2c3d4e5f6789012345",
  "originalUrl": "https://example.com",
  "shortUrl": "http://localhost:3002/abc123",
  "urlCode": "abc123",
  "clicks": 0,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

## Socket.IO Events

### Client to Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `new_url` | `{originalUrl: string}` | Request new shortened URL creation |
| `delete_url` | `{id: string}` | Request URL deletion by ID |
| `get_urls` | None | Request all URLs (used on reconnection) |

### Server to Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `urls` | `Array<URL>` | All URLs sent on connection |
| `url_created` | `URL Object` | New URL created notification |
| `url_deleted` | `{id: string}` | URL deletion notification |
| `url_clicked` | `{id: string, clicks: number}` | Click count update |
| `processing_url` | `{originalUrl: string}` | URL processing acknowledgment |
| `error` | `{message: string}` | Error notification |

## Data Model

### URL Schema

```javascript
{
  originalUrl: String,    // Required: Original long URL
  shortUrl: String,       // Required: Complete shortened URL
  urlCode: String,        // Required: Unique short code
  clicks: Number,         // Default: 0, tracks access count
  createdAt: Date        // Default: Current timestamp
}
```

## Performance Features

**Dual-Layer Caching**
- URL lookup cache for database query optimization
- Redirect cache for instant URL resolution
- Automatic cache invalidation and updates

**Connection Optimization**
- MongoDB connection pooling and retry logic
- Socket.IO connection management with heartbeat
- Efficient memory management for cache storage

**Real-Time Efficiency**
- Event-driven architecture for minimal latency
- Selective broadcasting to prevent unnecessary updates
- Optimized database queries with lean operations

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │◄──►│   Socket.IO     │◄──►│  Express API    │
│   (Frontend)    │    │   Real-time     │    │   (Backend)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └─────────────►│   HTTP REST     │◄─────────────┘
                        │     API         │
                        └─────────────────┘
                                │
                        ┌─────────────────┐
                        │    MongoDB      │
                        │   Database      │
                        └─────────────────┘
```

## Error Handling

The API implements comprehensive error handling:

- **URL Validation**: Validates URL format before processing
- **Database Errors**: Handles connection issues and duplicate entries
- **Socket Errors**: Graceful error emission to connected clients
- **Retry Logic**: Automatic reconnection for database failures

## Security Features

- **CORS Configuration**: Controlled cross-origin access
- **Input Validation**: URL format validation and sanitization
- **Rate Limiting Ready**: Architecture supports rate limiting implementation
- **Error Sanitization**: Safe error messages without sensitive data exposure

## Deployment

### Environment Variables

```bash
PORT=3002                          # Server port
MONGODB_URI=your_connection_string # MongoDB connection string
NODE_ENV=production               # Environment mode
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3002
CMD ["npm", "start"]
```

## Contributing Guidelines

![Contributing](https://img.shields.io/badge/Contributing-Guidelines-purple?style=for-the-badge&logo=git&logoColor=white)

### Development Workflow

1. **Fork Repository** - Create a personal fork with feature branch from `main`
2. **Environment Setup** - Configure local MongoDB and install dependencies
3. **Code Development** - Follow established patterns and implement comprehensive error handling
4. **Testing** - Test all endpoints and Socket.IO events thoroughly
5. **Documentation** - Update API documentation for any changes
6. **Pull Request** - Submit detailed PR with testing notes and change summary

### Code Standards

- Use async/await for asynchronous operations
- Implement comprehensive error handling
- Follow RESTful API conventions
- Maintain consistent logging practices
- Write descriptive commit messages

## Performance Metrics

- **URL Creation**: < 100ms average response time
- **URL Redirect**: < 50ms with caching enabled
- **Real-time Updates**: < 10ms latency for connected clients
- **Database Operations**: Optimized with indexing and lean queries

## Contact & Support

![Email](https://img.shields.io/badge/Email-aadigunjal0975%40gmail.com-D14836?style=for-the-badge&logo=gmail&logoColor=white)
![LinkedIn](https://img.shields.io/badge/LinkedIn-aadityagunjal0975-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)

**Technical Support & API Integration**

For API integration support, technical documentation, or development collaboration:

- **Primary Contact:** [aadigunjal0975@gmail.com](mailto:aadigunjal0975@gmail.com)
- **LinkedIn:** [aadityagunjal0975](https://www.linkedin.com/in/aadityagunjal0975)
- **GitHub Issues:** [Create Issue](https://github.com/aaditya09750/urlshortenerApi/issues)

## License & Usage Rights

![License](https://img.shields.io/badge/License-All_Rights_Reserved-red?style=for-the-badge&logo=copyright&logoColor=white)

**Usage Rights:** All rights reserved by the author. Contact for licensing inquiries and commercial usage permissions.

**Attribution Required:** Please credit the original author for any derivative works or commercial implementations.

---

**AG-URL Shortener API** delivers enterprise-grade URL shortening capabilities with real-time functionality and robust performance optimization. This backend service demonstrates expertise in scalable API design, real-time communication protocols, and efficient database management with a focus on reliability and performance.

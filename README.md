# Secure Note-Taking REST API

A production-ready REST API built with Node.js, Express, and MongoDB. The application provides role-based note management, authentication with JWT, strict MongoDB schema indexing, and two aggregation pipelines for analytical data retrieval.

---

## Tech Stack

- **Runtime**: Node.js (>= 18)
- **Framework**: Express 5
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (jsonwebtoken) and password hashing with bcryptjs (cost factor 12)
- **Validation**: express-validator
- **Security**: helmet, cors, express-rate-limit, custom in-place NoSQL sanitization middleware
- **Logging**: morgan (disabled during automated tests)

---

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm (version 9 or higher)
- MongoDB instance (local or remote MongoDB Atlas cluster)

### Installation & Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/shuvoredsky/notes-backend-.git
   cd notes-backend-
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the root directory by copying `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Fill in your actual database connection string and secrets.

4. **Seed initial admin account** (optional, recommended for initial testing):
   ```bash
   npm run seed:admin
   ```
   This creates an admin account if one with `ADMIN_EMAIL` does not already exist.

5. **Start development server**:
   ```bash
   npm run dev
   ```

6. **Start production server**:
   ```bash
   npm start
   ```

---

## Environment Variables

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | No | `5000` | Port on which the HTTP server listens |
| `MONGO_URI` | **Yes** | — | MongoDB connection string (e.g. Atlas cluster URI) |
| `JWT_SECRET` | **Yes** | — | Cryptographic secret for signing JWT access tokens |
| `JWT_EXPIRES_IN` | No | `7d` | Expiration time for JWT access tokens (e.g. `7d`, `24h`) |
| `CLIENT_URL` | No | `http://localhost:3000` | Allowed CORS origins (comma-separated for multiple origins) |
| `ADMIN_EMAIL` | For seed | — | Email used by `npm run seed:admin` |
| `ADMIN_PASSWORD` | For seed | — | Password used by `npm run seed:admin` |
| `NODE_ENV` | No | `development` | Environment mode (`development`, `production`, `test`) |

The server will fail fast at startup if `MONGO_URI` or `JWT_SECRET` is missing.

---

## Available Scripts

- `npm start`: Runs the server with Node.js (`node src/server.js`).
- `npm run dev`: Runs the server with `nodemon` for auto-reloading on file changes.
- `npm run seed:admin`: Creates or verifies the default admin account from environment variables.

---

## Folder Structure

```
notes-backend/
├── render.yaml               # Render deployment blueprint
├── package.json              # Project dependencies and npm scripts
├── .env.example              # Template for environment variables
├── .gitignore                # Ignored paths (node_modules, .env, docs)
├── README.md                 # Project documentation
└── src/
    ├── app.js                # Express app setup, security middleware, and routes
    ├── server.js             # Process entrypoint, env verification, and DB startup
    ├── config/
    │   └── db.js             # Mongoose connection handler
    ├── controllers/
    │   ├── authController.js # Register, login, get current user
    │   ├── noteController.js # Note CRUD with user isolation and admin override
    │   ├── postController.js # Post CRUD and Scenario 2 aggregation lookup
    │   └── userController.js # Admin user management and Scenario 1 aggregation
    ├── middleware/
    │   ├── authMiddleware.js # Bearer token verification and req.user attachment
    │   ├── errorMiddleware.js# 404 handler and unified JSON error handler
    │   ├── rateLimiter.js    # General and strict auth rate limiters
    │   ├── roleMiddleware.js # Role-based access control (admin authorization)
    │   └── sanitizeMiddleware.js # In-place NoSQL injection sanitizer
    ├── models/
    │   ├── Note.js           # Note schema, toJSON transform, and schema indexes
    │   ├── Post.js           # Post schema, toJSON transform, and schema index
    │   └── User.js           # User schema, bcrypt hook, and schema indexes
    ├── routes/
    │   ├── authRoutes.js     # Auth endpoints and validation
    │   ├── noteRoutes.js     # Note endpoints and validation
    │   ├── postRoutes.js     # Post CRUD endpoints and validation
    │   └── userRoutes.js     # Admin user management and aggregation routes
    └── utils/
        ├── apiResponse.js    # Standard JSON success and paginated response helpers
        ├── jwt.js            # Token generation and verification
        ├── pagination.js     # Standard pagination parser and metadata builder
        └── seedAdmin.js      # CLI script to seed initial admin user
```

---

## Roles and Permissions

The system supports two user roles: `user` and `admin`.

- **User**:
  - Can register and log in.
  - Can read, create, update, and delete only their own notes.
  - Can create posts and update/delete their own posts.
  - Cannot access administrative user management endpoints.
- **Admin**:
  - Inherits all normal user capabilities.
  - Can view all notes across all users, or filter by specific owner (`?owner=<userId>`).
  - Can update or delete any note.
  - Can update or delete any post.
  - Can view, create, update, and delete any user account (cannot delete own account).
  - Deleting a user cascades to remove all notes and posts owned by that user.
  - Can access the Aggregation Scenario 1 endpoint (`GET /api/users/grouped-by-interests`).

---

## API Endpoints

### Health Check

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Returns service status (`200 OK`) |

### Authentication (`/api/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register a new user (`role` is always forced to `user`) |
| `POST` | `/api/auth/login` | Public | Authenticate with email and password, returns JWT token |
| `GET` | `/api/auth/me` | User / Admin | Get profile of currently authenticated user |

### Notes (`/api/notes`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/notes` | User / Admin | Create a new note (owner set from token) |
| `GET` | `/api/notes` | User / Admin | List notes paginated (user: own notes; admin: all or `?owner=`) |
| `GET` | `/api/notes/:id` | User / Admin | Get single note by ID (user: own only; admin: any) |
| `PUT` | `/api/notes/:id` | User / Admin | Update note by ID (user: own only; admin: any) |
| `DELETE` | `/api/notes/:id` | User / Admin | Delete note by ID (user: own only; admin: any) |

### Users & Aggregations (`/api/users`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/:id/posts` | Public | **Aggregation Scenario 2**: Get user profile and all posts via `$lookup` pipeline |
| `GET` | `/api/users/grouped-by-interests` | Admin | **Aggregation Scenario 1**: Group users by interest with single `$facet` pipeline |
| `GET` | `/api/users` | Admin | List all users paginated, newest first |
| `POST` | `/api/users` | Admin | Create a new user with specified role and interests |
| `GET` | `/api/users/:id` | Admin | Get single user by ID |
| `PUT` | `/api/users/:id` | Admin | Update user details, role, or password |
| `DELETE` | `/api/users/:id` | Admin | Delete user, cascading deletion to all notes and posts |

### Posts (`/api/posts`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/posts` | User / Admin | Create a post (author assigned from token) |
| `GET` | `/api/posts/:id` | Public | Get single post by ID with populated author name and email |
| `PUT` | `/api/posts/:id` | Author / Admin | Update post title or content |
| `DELETE` | `/api/posts/:id` | Author / Admin | Delete post |

---

## Pagination Format

All listing endpoints accept query parameters for pagination:
- `page`: Page number (integer >= 1, defaults to `1`).
- `limit`: Items per page (integer >= 1, defaults to `10`, maximum `50`).

Responses from paginated endpoints follow a standardized structure:

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "pages": 5
  },
  "message": "Data retrieved successfully"
}
```

---

## Indexing and Aggregation

### Schema Indexes

All database indexes are declared explicitly below schemas using Mongoose `schema.index()`. Inline field options (`unique: true` or `index: true`) and redundant indexes are avoided.

| Model | Index Pattern | Queries Supported | Rationale |
| :--- | :--- | :--- | :--- |
| `User` | `{ email: 1 }` (unique) | Authentication login, registration duplicate check, admin user email search | Enforces unique email constraint in MongoDB and supports $O(\log N)$ user lookups by email. |
| `User` | `{ createdAt: -1 }` | `GET /api/users` | Supports paginated admin user list sorted newest first (`IXSCAN`). |
| `User` | `{ interests: 1 }` | `GET /api/users/grouped-by-interests?interest=<value>` | Multikey index supporting the initial `$match` stage when filtering Scenario 1 by interest. |
| `Note` | `{ owner: 1, createdAt: -1 }` | `GET /api/notes` (user list or admin `?owner=`), user deletion cascade | Compound index covering owner equality match combined with newest-first sort, and fast cascade deletion by owner. |
| `Note` | `{ createdAt: -1 }` | `GET /api/notes` (admin global list without filter) | Supports paginated global note listing sorted newest first. |
| `Post` | `{ author: 1, createdAt: -1 }` | `GET /api/users/:id/posts` (Scenario 2 `$lookup`), user deletion cascade | Powers the inner `$lookup` sub-pipeline match and sort stages (`IXSCAN`, 0 collection scans), and supports cascade post deletion by author. |

**Intentional Index Omissions**:
- `role`: Never queried independently; checked in memory on `req.user`.
- `tags`: No tags field exists in the Note requirements.
- Global `createdAt` on `Post`: There is no global public `GET /api/posts` endpoint; posts are only listed through their author in Scenario 2.
- Unfiltered Scenario 1: Grouping all users by interest fundamentally requires reading every user record (`COLLSCAN`). The `interests: 1` index exclusively accelerates queries where the optional `?interest=` filter is supplied.

### Aggregation Pipelines

#### Scenario 1: Group Users by Interest (`GET /api/users/grouped-by-interests`)
Implemented in a **single `User.aggregate()` call**:
1. Optional `$match: { interests: interest }` (leverages the `{ interests: 1 }` multikey index when filtered).
2. `$unwind: '$interests'`.
3. Optional post-unwind `$match: { interests: interest }` (ensures only the requested group is returned).
4. `$group: { _id: '$interests', count: { $sum: 1 }, users: { $push: { _id: '$_id', name: '$name', email: '$email' } } }`.
5. `$sort: { count: -1, _id: 1 }` (most popular interests first, ties broken alphabetically).
6. `$facet`: Produces paginated `data` (`$skip`, `$limit`) and `total` count within the same database round-trip.

#### Scenario 2: Public User Posts via `$lookup` (`GET /api/users/:id/posts`)
Implemented in a **single `User.aggregate()` call**:
1. `$match: { _id: ObjectId(id) }` (locates the user via default `_id` index).
2. `$lookup`: Correlated sub-pipeline joining the `posts` collection using `let: { userId: '$_id' }`:
   - `$match: { $expr: { $eq: ['$author', '$$userId'] } }`
   - `$sort: { createdAt: -1 }`
   - Supported directly by `{ author: 1, createdAt: -1 }` (verified `IXSCAN` and 0 collection scans).
   - `$facet`: Provides paginated posts (`$skip`, `$limit`, projected without `__v`) and `total` count of user posts.
3. `$project`: Normalizes output into user information (`_id`, `name`, `email`), `posts` array, and total post count.

---

## Deploying to Render with MongoDB Atlas

1. **MongoDB Atlas Network Access**:
   In your MongoDB Atlas dashboard, navigate to **Network Access** and add `0.0.0.0/0` (Allow access from anywhere) so that Render's dynamic IP ranges can connect.

2. **Render Web Service Configuration**:
   Create a new **Web Service** on Render and connect this repository:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`

3. **Render Environment Variables**:
   Configure the following in the Render service settings:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `MONGO_URI`: Your MongoDB Atlas connection string.
   - `JWT_SECRET`: A secure random secret string.
   - `JWT_EXPIRES_IN`: `7d`
   - `CLIENT_URL`: URL of your frontend application (e.g. `https://your-app.onrender.com` or comma-separated list).
   - `ADMIN_EMAIL`: Email for administrative seed.
   - `ADMIN_PASSWORD`: Strong password for administrative seed.

4. **Render Free Tier Notice**:
   On Render's free tier, services spin down after 15 minutes of inactivity. The first incoming request may take 30 to 60 seconds while the container initializes. Subsequent requests respond normally.

# Secure Note-Taking REST API - Technical Architecture & Implementation Plan

## 1. Project Overview & Objectives
A production-ready, secure RESTful API built with **Node.js**, **Express**, and **MongoDB (Mongoose)**, featuring:
- Role-Based Access Control (RBAC): `user` vs. `admin`.
- Strict user data isolation: `user` access strictly scoped to their own notes; `admin` access with comprehensive management capabilities and global note visibility.
- Ubiquitous pagination across all list endpoints.
- Strict performance indexing: Defined exclusively via `schema.index()` in model files (no inline `unique: true` or `index: true`, no `_id` indexing).
- Optimized MongoDB Aggregations:
  - **Scenario 1**: Group users by interest using exactly one `User.aggregate()` call.
  - **Scenario 2**: Retrieve all posts of a particular user using a single aggregation pipeline with a `$lookup` stage, supported by indexes.
- Deployment readiness for Render free tier and local execution.

---

## 2. Architecture & Directory Structure

The backend application is structured cleanly into distinct layers separating configuration, business logic, data persistence, routing, and cross-cutting middleware.

```text
notes-backend/
├── config/
│   └── db.js                 # Database connection logic & event listeners
├── controllers/
│   ├── authController.js     # User registration, login, profile retrieval
│   ├── userController.js     # Admin user management & Aggregation Scenario 1 (by interest)
│   ├── noteController.js     # Role-aware note CRUD & pagination
│   └── postController.js     # Public posts CRUD & Aggregation Scenario 2 ($lookup by user)
├── middleware/
│   ├── authMiddleware.js     # JWT token extraction and authentication verification
│   ├── roleMiddleware.js     # Role-based access control (RBAC: 'user' / 'admin')
│   ├── validateMiddleware.js # Input validation helpers
│   └── errorMiddleware.js    # Global exception and 404 handler
├── models/
│   ├── User.js               # User schema with schema.index()
│   ├── Note.js               # Note schema with schema.index()
│   └── Post.js               # Post schema with schema.index()
├── routes/
│   ├── authRoutes.js         # Routes for /api/auth
│   ├── userRoutes.js         # Routes for /api/users
│   ├── noteRoutes.js         # Routes for /api/notes
│   ├── postRoutes.js         # Routes for /api/posts
│   └── index.js              # Central API router aggregator + health check
├── utils/
│   ├── apiResponse.js        # Standardized API response format & custom ApiError class
│   ├── jwt.js                # JWT sign and verify helpers
│   └── pagination.js         # Standard pagination parser and metadata generator
├── .env.example              # Environment variable documentation template
├── .gitignore                # Ignored patterns (node_modules, .env, logs)
├── app.js                    # Express application instance setup & middleware pipeline
├── server.js                 # HTTP server bootstrap & graceful shutdown handling
├── package.json              # Project dependencies and npm scripts
└── render.yaml               # Deployment blueprint for Render
```

---

## 3. Data Models & Schema Design

All indexes adhere strictly to the rule:
- Defined **only** with `schema.index()`.
- **No** `unique: true` or `index: true` inside field definitions.
- **No** index for `_id` (handled automatically by MongoDB).

### 3.1 User Model (`models/User.js`)
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `name` | `String` | required, trim, minlength: 2, maxlength: 50 | Full name of the user |
| `email` | `String` | required, lowercase, trim | User email address (unique via `schema.index`) |
| `password` | `String` | required, select: false | Bcrypt-hashed password string |
| `role` | `String` | enum: `['user', 'admin']`, default: `'user'` | Access control role |
| `interests` | `[String]` | default: `[]`, lowercase, trim | Array of user interests |
| `createdAt` | `Date` | managed by timestamps | Creation timestamp |
| `updatedAt` | `Date` | managed by timestamps | Last update timestamp |

### 3.2 Note Model (`models/Note.js`)
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `title` | `String` | required, trim, maxlength: 120 | Note title |
| `content` | `String` | required | Note body / markdown content |
| `owner` | `ObjectId` | ref: `'User'`, required | Reference to note creator |
| `tags` | `[String]` | default: `[]`, lowercase, trim | Optional tags for categorization |
| `createdAt` | `Date` | managed by timestamps | Creation timestamp |
| `updatedAt` | `Date` | managed by timestamps | Last update timestamp |

### 3.3 Post Model (`models/Post.js`)
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `title` | `String` | required, trim, maxlength: 150 | Public post title |
| `content` | `String` | required | Public post content |
| `author` | `ObjectId` | ref: `'User'`, required | Reference to author |
| `createdAt` | `Date` | managed by timestamps | Creation timestamp |
| `updatedAt` | `Date` | managed by timestamps | Last update timestamp |

---

## 4. Endpoints & API Contract

All list endpoints support pagination query parameters: `page` (default: 1) and `limit` (default: 10, max: 100).
Responses follow a standard format:
```json
{
  "success": true,
  "message": "...",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 4.1 Authentication Endpoints (`/api/auth`)
| Method | Path | Access | Query / Body Params | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Body: `{ name, email, password, interests? }` | Register a new user (`role` defaults to `'user'`) |
| `POST` | `/api/auth/login` | Public | Body: `{ email, password }` | Authenticate user; returns JWT token & user profile |
| `GET` | `/api/auth/me` | Authenticated (`user`, `admin`) | None | Get current authenticated user details |

### 4.2 User Management & Aggregation Endpoints (`/api/users`)
| Method | Path | Access | Query / Body Params | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | `admin` | Query: `page`, `limit`, `role` | List users with pagination |
| `POST` | `/api/users` | `admin` | Body: `{ name, email, password, role, interests }` | Admin creates user directly |
| `GET` | `/api/users/:id` | `admin` | Param: `id` | Get user profile by ID |
| `PUT` | `/api/users/:id` | `admin` | Body: `{ name, role, interests }` | Admin updates user record |
| `DELETE` | `/api/users/:id` | `admin` | Param: `id` | Admin deletes user record |
| `GET` | `/api/users/by-interest` | Authenticated (`user`, `admin`) | None | **Aggregation Scenario 1**: Group users by interest (single `User.aggregate()` call) |

### 4.3 Notes Endpoints (`/api/notes`)
| Method | Path | Access | Query / Body Params | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/notes` | Authenticated (`user`, `admin`) | Body: `{ title, content, tags? }` | Create note with `owner = req.user._id` |
| `GET` | `/api/notes` | Authenticated (`user`, `admin`) | Query: `page`, `limit` | List notes (paginated). **Isolation**: `user` receives only their own notes; `admin` sees all notes across all users. |
| `GET` | `/api/notes/:id` | Authenticated (`user`, `admin`) | Param: `id` | Get single note. `user` can only access their own; `admin` can access any note. |
| `PUT` | `/api/notes/:id` | Authenticated (`user`, `admin`) | Param: `id`, Body: `{ title?, content?, tags? }` | Update note. `user` can only update their own; `admin` can update any note. |
| `DELETE` | `/api/notes/:id` | Authenticated (`user`, `admin`) | Param: `id` | Delete note. `user` can only delete their own; `admin` can delete any note. |

### 4.4 Posts Endpoints (`/api/posts`)
| Method | Path | Access | Query / Body Params | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/posts` | Authenticated (`user`, `admin`) | Body: `{ title, content }` | Create a public post authored by `req.user._id` |
| `GET` | `/api/posts` | Public | Query: `page`, `limit` | List all public posts with author summary (paginated) |
| `GET` | `/api/posts/:id` | Public | Param: `id` | Get a single public post by ID with author details |
| `GET` | `/api/posts/user/:userId` | Public | Param: `userId` | **Aggregation Scenario 2**: Retrieve all posts of a specific user with author details using `$lookup` |

### 4.5 Health Check
| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Returns `{ status: "ok", timestamp, uptime }` for Render keep-alive and health checks |

---

## 5. Index Plan

In accordance with specifications:
- Indexes are declared **only** with `schema.index()`.
- No redundant indexes (compound indexes are carefully arranged to serve prefix queries).
- No index on `_id` (automatically provided as a unique clustered/primary index by MongoDB).

| Collection / Model | Index Specification | Exact Query Supported | Why Needed / Justification |
| :--- | :--- | :--- | :--- |
| **User** | `userSchema.index({ email: 1 }, { unique: true })` | `User.findOne({ email })` | Supports login lookup and registration uniqueness check with $O(\log N)$ B-tree index rather than a collection scan ($O(N)$). |
| **User** | `userSchema.index({ role: 1, createdAt: -1 })` | `User.find({ role }).sort({ createdAt: -1 })` and `User.find().sort({ createdAt: -1 })` | Supports admin paginated user list sorted chronologically, with optional role filtering using Equality-Sort-Range (ESR) rule. |
| **User** | `userSchema.index({ interests: 1 })` | `User.aggregate([{ $unwind: "$interests" }, { $group: ... }])` | Multikey index over the `interests` array to accelerate array unwinding and grouping in Aggregation Scenario 1. |
| **Note** | `noteSchema.index({ owner: 1, createdAt: -1 })` | `Note.find({ owner: userId }).sort({ createdAt: -1 })` and `Note.findOne({ _id, owner: userId })` | Core index for regular `user` note isolation. Matches `owner` equality and sorts chronologically without in-memory sort (`SORT_KEY_GENERATOR`), ensuring fast paginated retrieval. |
| **Note** | `noteSchema.index({ createdAt: -1 })` | `Note.find().sort({ createdAt: -1 })` | Used by `admin` note listing query where notes from all owners are retrieved in reverse chronological order. |
| **Post** | `postSchema.index({ author: 1, createdAt: -1 })` | `$match: { author: ObjectId(userId) }` in `$lookup` pipeline and `Post.find({ author: userId }).sort({ createdAt: -1 })` | Supports Aggregation Scenario 2 match stage and filtered post retrieval by author with chronological sorting. |
| **Post** | `postSchema.index({ createdAt: -1 })` | `Post.find().sort({ createdAt: -1 })` | Supports the public post feed paginated listing sorted by creation date. |

---

## 6. Aggregation Pipeline Designs

### 6.1 Scenario 1: Group Users by Interest
**Requirement**: Users have an `interests: [String]` array. Build a view of users grouped by interest using **EXACTLY ONE** `User.aggregate()` call with no other queries.

```javascript
// Pipeline implementation in userController.js
const groupedUsers = await User.aggregate([
  // 1. Unwind interests array to produce a document per interest element
  { $unwind: "$interests" },

  // 2. Group by interest name and collect user summary projections
  {
    $group: {
      _id: "$interests",
      users: {
        $push: {
          _id: "$_id",
          name: "$name",
          email: "$email",
          role: "$role"
        }
      },
      count: { $sum: 1 }
    }
  },

  // 3. Sort interests alphabetically or by member count
  {
    $sort: { count: -1, _id: 1 }
  },

  // 4. Project clean output shape
  {
    $project: {
      _id: 0,
      interest: "$_id",
      count: 1,
      users: 1
    }
  }
]);
```
**Index Support**: `userSchema.index({ interests: 1 })` multikey index speeds up element scanning.

---

### 6.2 Scenario 2: Retrieve All Posts of a Particular User with `$lookup`
**Requirement**: Users write posts in a separate `Posts` collection. Retrieve all posts of a particular user using a **single aggregation pipeline with a `$lookup` stage**, supported by indexes.

```javascript
// Pipeline implementation in postController.js
const results = await Post.aggregate([
  // 1. Match posts belonging strictly to the requested user ID
  {
    $match: {
      author: new mongoose.Types.ObjectId(userId)
    }
  },

  // 2. Sort posts chronologically (latest first) using { author: 1, createdAt: -1 } index
  {
    $sort: {
      createdAt: -1
    }
  },

  // 3. Join author details from the "users" collection
  {
    $lookup: {
      from: "users",
      localField: "author",
      foreignField: "_id",
      as: "authorDetails"
    }
  },

  // 4. Unwind author details (1:1 match)
  {
    $unwind: {
      path: "$authorDetails",
      preserveNullAndEmptyArrays: true
    }
  },

  // 5. Exclude sensitive fields from user projection
  {
    $project: {
      title: 1,
      content: 1,
      createdAt: 1,
      updatedAt: 1,
      author: {
        _id: "$authorDetails._id",
        name: "$authorDetails.name",
        email: "$authorDetails.email"
      }
    }
  }
]);
```
**Index Support**:
- `postSchema.index({ author: 1, createdAt: -1 })` ensures index-covered `$match` and `$sort` stages.
- `_id` on the `users` collection provides instant B-tree lookup for the `$lookup` join foreignField.

---

## 7. Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port for the Express server to listen on |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `MONGODB_URI` | `mongodb://localhost:27017/secure-notes` | MongoDB connection string (Atlas URI on Render) |
| `JWT_SECRET` | `super_secret_jwt_key_replace_in_production` | Secret string for HMAC SHA-256 JWT signing |
| `JWT_EXPIRES_IN` | `7d` | Lifetime of signed JWT tokens |
| `BCRYPT_SALT_ROUNDS`| `10` | Salt rounds for bcrypt password hashing |
| `CORS_ORIGIN` | `*` | Allowed CORS origin (can restrict to frontend domain) |

---

## 8. Commit Plan (15 Conventional Commits)

Each commit maps strictly to an incremental, verifiable milestone:

1. `docs: add architecture plan and progress tracking`
   - Create `docs/PLAN.md` and `docs/PROGRESS.md`.
2. `chore: initialize backend project and dependencies`
   - Setup `package.json`, `.gitignore`, `.env.example`, and install production/development dependencies.
3. `feat: setup server configuration and database connection`
   - Implement `config/db.js`, `app.js`, `server.js`, and health check `/api/health`.
4. `feat: implement response and pagination utilities`
   - Add `utils/apiResponse.js`, `utils/pagination.js`, and `utils/jwt.js`.
5. `feat: create User model with strict schema indexes`
   - Implement `models/User.js` with bcrypt pre-save hash, password comparison, and `schema.index()` declarations.
6. `feat: implement authentication and authorization middleware`
   - Implement `middleware/authMiddleware.js` (JWT token verification) and `middleware/roleMiddleware.js` (RBAC enforcement).
7. `feat: implement authentication endpoints and controller`
   - Implement `controllers/authController.js` and `routes/authRoutes.js` (`/register`, `/login`, `/me`).
8. `feat: create Note model with schema indexes`
   - Implement `models/Note.js` with `schema.index({ owner: 1, createdAt: -1 })` and `schema.index({ createdAt: -1 })`.
9. `feat: implement note CRUD controller and routes with role isolation`
   - Implement `controllers/noteController.js` and `routes/noteRoutes.js` with strict user vs. admin access policies.
10. `feat: implement admin user management CRUD and routes`
    - Implement admin operations in `controllers/userController.js` and `routes/userRoutes.js` (`GET`, `POST`, `GET :id`, `PUT :id`, `DELETE :id`).
11. `feat: implement Aggregation Scenario 1 for users grouped by interest`
    - Implement `GET /api/users/by-interest` with single `User.aggregate()` pipeline.
12. `feat: create Post model with schema indexes`
    - Implement `models/Post.js` with `schema.index({ author: 1, createdAt: -1 })` and `schema.index({ createdAt: -1 })`.
13. `feat: implement public posts CRUD and Aggregation Scenario 2 with $lookup`
    - Implement `controllers/postController.js` and `routes/postRoutes.js`, including `GET /api/posts/user/:userId` aggregation pipeline.
14. `feat: add request validation and centralized error handling`
    - Implement `middleware/validateMiddleware.js`, `middleware/errorMiddleware.js`, and 404 handler.
15. `chore: prepare deployment configuration for Render and documentation`
    - Add `render.yaml`, update `README.md` with complete API usage instructions and local/render setup guides.

---

## 9. Render Free Tier & Deployment Considerations
- **Cold Starts**: Render free instances spin down after inactivity. The lightweight `/api/health` endpoint serves as a fast probe.
- **Environment Isolation**: Strict fallback configurations so the app runs smoothly both locally with a local MongoDB instance and remotely on Render connected to MongoDB Atlas.
- **Graceful Shutdown**: SIGINT and SIGTERM listeners to safely close Mongoose connections and Express listener during deploy transitions.


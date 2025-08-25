# ChainLit MVP - Token Analysis Application

A full-stack web application that provides explainable token scoring and risk analysis for cryptocurrency tokens.

## 🚀 Features

- **Token Analysis**: Analyze any token by symbol (e.g., ETH) or contract address (e.g., 0x123...)
- **Explainable Scoring**: Get detailed scores (0-100) with evidence-based explanations
- **Risk Assessment**: Understand risk levels and market outlook
- **Recent Searches**: View and re-analyze previously searched tokens
- **Real-time Updates**: Instant analysis with live backend communication

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + TypeScript + Prisma
- **Database**: SQLite with Prisma ORM
- **API**: RESTful endpoints for token analysis

## 📁 Project Structure

```
chainlit/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.tsx       # Main application component
│   │   └── main.tsx      # Application entry point
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   ├── index.ts      # Server entry point
│   │   ├── db/           # Database configuration
│   │   └── lib/          # Business logic
│   └── package.json
└── README.md
```

## 🛠️ Setup & Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Backend Setup
```bash
cd server
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

### Frontend Setup
```bash
cd client
npm install
npm run dev
```

## 🌐 Running the Application

1. **Start Backend Server** (Terminal 1):
   ```bash
   cd server
   npm run dev
   ```
   Server runs on: `http://localhost:3000`

2. **Start Frontend Server** (Terminal 2):
   ```bash
   cd client
   npm run dev
   ```
   Frontend runs on: `http://localhost:5173` (or next available port)

3. **Open Browser**: Navigate to the frontend URL shown in the terminal

## 🔌 API Endpoints

### `GET /health`
Health check endpoint
- **Response**: `"Server is running 🚀"`

### `GET /analyze?token={token}`
Analyze a token and return scoring results
- **Parameters**: `token` (required) - Token symbol or contract address
- **Response**: Analysis result with score, risk, outlook, and evidence

### `GET /recent`
Get recent token analysis history
- **Response**: Array of recent token lookups

## 💡 Usage Examples

### Analyze by Symbol
```
Input: ETH
Result: Score 75/100, Low Risk, Bearish Outlook
```

### Analyze by Contract Address
```
Input: 0x1234567890abcdef...
Result: Score with detailed evidence and risk assessment
```

## 🎯 Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Axios
- **Backend**: Express.js, TypeScript, Zod validation
- **Database**: SQLite, Prisma ORM
- **Development**: ts-node-dev, ESLint, TypeScript

## 🔧 Development Scripts

### Backend (server/)
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations

### Frontend (client/)
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## 📊 Database Schema

The application uses Prisma with SQLite to store:
- Token analysis results
- Search history
- Timestamps for recent searches

## 🚧 Current Status

This is an MVP (Minimum Viable Product) that includes:
- ✅ Basic token analysis functionality
- ✅ Mock scoring engine
- ✅ Database persistence
- ✅ Recent search history
- ✅ Responsive UI
- ✅ Error handling

## 🔮 Future Enhancements

- Real-time market data integration
- Advanced risk modeling
- User authentication
- Portfolio tracking
- API rate limiting
- Production deployment

## 🤝 Contributing

This is a learning project demonstrating full-stack development with modern web technologies.

## 📝 License

MIT License - Feel free to use this code for learning and development purposes.

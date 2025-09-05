# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 IMPLEMENTATION MISSION: Transform Dashboard to Production Trading Platform

**CRITICAL CONTEXT**: This repository is undergoing a systematic transformation from a market data dashboard into a production-ready algorithmic trading platform over 32 weeks. We are following a comprehensive implementation plan with strict task-based development, agent specialization, and continuous validation.

### 📋 MANDATORY TASK-BASED DEVELOPMENT SYSTEM

**⚠️ CRITICAL RULE: ONLY work on tasks from `COMPLETE_TASK_LIST.md` - NO exceptions!**

All development must follow the structured 128-task system with these requirements:

- **Task Selection**: Only work on tasks marked as "ready" (all dependencies completed)
- **Unique Task ID**: Each task has a specific ID (DB-001, BE-001, FE-001, etc.)
- **Clear Acceptance Criteria**: Every task defines exactly what "done" means
- **Agent Specialization**: Work only on tasks matching your agent type
- **Dependency Respect**: Never start a task until prerequisites are 100% complete
- **Validation Mandatory**: Every task must pass all validation steps before proceeding

### 📊 COMPLETE TASK SYSTEM OVERVIEW

**Total Implementation Scope**: 128 tasks across 32 weeks (1,856 hours)

**Current Status**: Review `COMPLETE_TASK_LIST.md` for full task specifications

**Phase 1 Priority Tasks (Weeks 1-8)**:
- DB-001: PostgreSQL & TimescaleDB Setup
- DB-002: Database Schema Implementation  
- BE-001: Database Connection Manager
- BE-007: Base Strategy Interface Design
- BE-010: Technical Indicators Library
- BE-016: Strategy Engine Core Implementation

### 🎯 CURRENT DEVELOPMENT PHASE

**Phase 1: Critical Foundations (Weeks 1-8)**
- Database infrastructure with PostgreSQL + TimescaleDB
- Strategy execution engine with technical indicators
- Risk management and position management systems

### 👥 AGENT SPECIALIZATION SYSTEM

When working on this repository, identify your agent role:

**DatabaseAgent** 🗄️
- Database schema design and implementation
- Migrations, queries, performance optimization
- TimescaleDB configuration and time-series optimization

**BackendAgent** ⚙️  
- Node.js/TypeScript backend development
- Strategy engine, risk management, trading logic
- API endpoints and business logic implementation

**FrontendAgent** 🎨
- React/TypeScript component development
- shadcn/ui integration, responsive design
- Real-time data visualization and user experience

**MLAgent** 🧠
- Machine learning pipeline with TensorFlow.js
- Feature engineering and model training
- Prediction systems and ML-enhanced strategies

**DevOpsAgent** 🚀
- Infrastructure setup and deployment
- CI/CD pipelines and monitoring
- Production readiness and scaling

**TestingAgent** 🧪
- Test automation and quality assurance
- Performance testing and validation
- System integration verification

### ⚠️ MANDATORY DEVELOPMENT RULES - NO EXCEPTIONS

1. **TASK-ONLY DEVELOPMENT**: Work exclusively on tasks from `COMPLETE_TASK_LIST.md`
2. **AGENT SPECIALIZATION**: Only accept tasks matching your agent designation
3. **DEPENDENCY ENFORCEMENT**: Check task dependencies before starting - halt if not met
4. **MANDATORY VALIDATION**: After each task, run complete validation sequence:
   ```bash
   npm run build          # ✅ Must compile successfully
   npm run test           # ✅ All tests must pass
   npm run test:integration # ✅ Integration tests must pass  
   npm start              # ✅ System must start and function
   npm run lint           # ✅ Code quality must pass
   ```
5. **ZERO REGRESSION POLICY**: System must remain fully functional after every change
6. **ACCEPTANCE CRITERIA**: Every deliverable in task specification must be completed
7. **DOCUMENTATION UPDATES**: Update all relevant documentation for changes made

### 🚨 TASK EXECUTION PROTOCOL

**Before Starting ANY Task:**
1. ✅ **Verify Task ID**: Confirm task exists in `COMPLETE_TASK_LIST.md`
2. ✅ **Check Dependencies**: Ensure all prerequisite tasks are 100% complete
3. ✅ **Agent Match**: Confirm your agent type matches task assignment
4. ✅ **Review Acceptance Criteria**: Understand exactly what constitutes completion
5. ✅ **Validate Current System**: Ensure system works before making changes

**After Completing ANY Task:**
1. ✅ **Run Full Validation Suite**: All validation commands must pass
2. ✅ **Verify Acceptance Criteria**: Every requirement must be met
3. ✅ **Test System Integration**: Entire system must remain functional
4. ✅ **Update Progress Tracking**: Mark task as complete in tracking system
5. ✅ **Document Any Issues**: Record problems and solutions for future reference

### 📋 TASK SELECTION PROCESS

**Step 1: Identify Ready Tasks**
- Review `COMPLETE_TASK_LIST.md` for tasks with completed dependencies
- Current ready tasks: DB-001 (no dependencies), then DB-002, BE-001, etc.

**Step 2: Agent Assignment Verification** 
- 🗄️ DatabaseAgent: Tasks DB-001 through DB-006
- ⚙️ BackendAgent: Tasks BE-001 through BE-065  
- 🎨 FrontendAgent: Tasks FE-001 through FE-024
- 🧠 MLAgent: Tasks ML-001 through ML-013
- 🚀 DevOpsAgent: Tasks DO-001 through DO-009
- 🧪 TestingAgent: Tasks TE-001 through TE-013

**Step 3: Task Execution Request Format**
```
"I need you to act as [AgentType] and execute Task [ID]: [Title].

Please review the complete task specification in COMPLETE_TASK_LIST.md 
and implement all acceptance criteria including:
- [List specific deliverables]
- [Performance targets]
- [Testing requirements]

After completion, run the mandatory validation sequence."
```

### 📚 MANDATORY REFERENCE DOCUMENTS

**PRIMARY TASK REFERENCE** (Must consult for every task):
- 📋 `COMPLETE_TASK_LIST.md` - **ALL 128 TASKS** with specifications and acceptance criteria

**SUPPORTING ARCHITECTURE DOCUMENTS**:
- `IMPLEMENTATION_ROADMAP_2025.md` - 32-week strategic development plan  
- `CAPABILITY_GAP_ANALYSIS.md` - Current state vs target capabilities
- `STRATEGY_ENGINE_ARCHITECTURE.md` - Strategy system technical specification
- `BACKTESTING_ENGINE_ARCHITECTURE.md` - Backtesting system design
- `DATABASE_ARCHITECTURE.md` - Database design and optimization
- `FREQTRADE_ANALYSIS_UPDATE_2025.md` - Technical reference and inspiration

**⚠️ CRITICAL**: Every task must reference the specific requirements in `COMPLETE_TASK_LIST.md`. No work should begin without reviewing the exact task specification.

### 🚨 EMERGENCY PROTOCOLS

If the system breaks during development:
1. **STOP immediately** - do not continue with additional changes
2. **Revert the last change** that caused the issue
3. **Run full validation suite** to ensure system recovery
4. **Identify root cause** before attempting fix
5. **Update task validation** to prevent similar issues

### 🎯 SUCCESS METRICS

Every task completion must achieve:
- ✅ All acceptance criteria met
- ✅ Unit and integration tests passing
- ✅ Performance targets achieved
- ✅ System remains fully functional
- ✅ Documentation updated
- ✅ No security vulnerabilities introduced

### 💡 DEVELOPMENT PHILOSOPHY

We are building a **production-ready, enterprise-grade algorithmic trading platform** that will compete with established solutions like Freqtrade while leveraging modern web technologies and superior user experience. Every line of code should reflect this ambition.

**Quality over speed. Testing over assumptions. Architecture over quick fixes.**

## Development Commands

### Starting the Application
- `npm start` - Runs both backend and frontend concurrently using tsx and vite
- `npm run backend` - Start only the backend server (tsx watch src/backend/server.ts) 
- `npm run dev` - Start only the frontend development server (vite)

### Build & Quality
- `npm run build` - TypeScript compilation followed by Vite production build
- `npm run lint` - ESLint with TypeScript extensions, max warnings 0
- `npm run preview` - Preview production build locally

### Testing
- `npm test` - Run tests using Vitest
- `npm run test:ui` - Run tests with Vitest UI interface

## Architecture Overview

This is an algorithmic trading bot with a React frontend and Node.js backend, designed to integrate with dYdX v4 for live market data and trading.

### Project Structure
- **Frontend**: React + Vite + TypeScript + Tailwind + Shadcn UI components
  - `src/frontend/` - Main React application with dashboard views
  - `src/frontend/components/ui/` - Shadcn UI primitive components  
  - `src/frontend/hooks/` - React Query hooks for data fetching and WebSocket streams
  - `src/frontend/lib/api/` - API client wrappers
- **Backend**: Node.js HTTP server with dYdX integration
  - `src/backend/server.ts` - Main HTTP server with CORS and JSON handling
  - `src/backend/routes/` - API route handlers for dYdX data, orders, backtesting
  - `src/backend/dydx/` - dYdX Indexer client and WebSocket gateway
- **Shared**: Common types and utilities
  - `src/shared/types/trading.ts` - Comprehensive trading domain models and dYdX v4 types

### Key Technologies
- **UI Framework**: Shadcn components built on Radix UI primitives
- **Data Flow**: React Query for REST API calls, RxJS for WebSocket streams
- **Charting**: Lightweight Charts library loaded via CDN for candlestick visualization
- **Backend**: Plain Node.js HTTP server (no framework) proxying dYdX Indexer REST/WS
- **Testing**: Vitest with jsdom and Testing Library

### Backend API Structure
The backend serves as a proxy to dYdX v4 Indexer with these main endpoints:
- `/api/health` - Service health check
- `/api/dydx/markets` - Live market information
- `/api/dydx/candles` - Historical and live candlestick data
- `/api/dydx/oracle` - Oracle price feeds
- Future endpoints for wallet integration, order placement, and backtesting

### Frontend Data Architecture
- **State Management**: React Query for server state, local state for UI
- **Real-time Data**: RxJS observables for WebSocket streams
- **Chart Integration**: Direct lightweight-charts integration with dYdX candle data
- **Type Safety**: Comprehensive TypeScript types shared between frontend and backend

### Key Features Implemented
- Real-time market data from dYdX v4 Indexer
- Interactive candlestick charts with symbol/timeframe selection
- Markets table with live oracle prices and trading parameters
- Candle history table with filtering capabilities
- Strategy builder UI framework (backend strategy execution pending)
- Trading bot status monitoring with API connectivity indicators

### Development Notes
- Uses Vite proxy to route `/api/*` requests to backend at localhost:3001
- Backend uses plain HTTP server with manual CORS handling
- All data fetching goes through React Query hooks for caching and error handling
- Shadcn components should be added via CLI when new UI primitives are needed
- TypeScript strict mode enabled with path aliases configured
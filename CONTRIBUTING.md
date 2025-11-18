# Contributing to Multi-Brain Memory Sync Hub

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Development Setup

1. **Prerequisites**
   - Node.js 18+
   - PostgreSQL (or use Docker Compose)
   - Git

2. **Quick Start**
   ```bash
   # Clone the repository
   git clone <repository-url>
   cd multi-brain-memory-sync-hub

   # Run complete setup (with Docker)
   make setup

   # Or manual setup
   npm install
   docker-compose up -d  # Start PostgreSQL
   npm run db:migrate
   npm run db:seed

   # Start development servers
   npm run dev
   ```

3. **Project Structure**
   - `/backend` - Fastify API server
   - `/frontend` - Next.js web application
   - Root `package.json` manages both workspaces

## Development Workflow

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code style and patterns
   - Add/update tests if applicable
   - Update documentation if needed

3. **Test your changes**
   ```bash
   # Backend
   cd backend
   npm run build

   # Frontend
   cd frontend
   npm run build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   Follow conventional commits format:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `refactor:` - Code refactoring
   - `test:` - Test additions/changes
   - `chore:` - Maintenance tasks

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

- **TypeScript**: Use strict mode, prefer type safety
- **Formatting**: Follow existing patterns (consider adding Prettier)
- **Naming**: Use descriptive names, follow camelCase for variables/functions
- **Comments**: Document complex logic, avoid obvious comments

### Database Changes

If you modify the Prisma schema:

1. Create a migration:
   ```bash
   cd backend
   npx prisma migrate dev --name your_migration_name
   ```

2. Update seed file if needed:
   ```bash
   # Edit backend/src/prisma/seed.ts
   npm run db:seed
   ```

## Adding New Features

### Adding a New Provider

1. **Update Prisma schema** (if new provider type)
   ```prisma
   enum ProviderType {
     OPENAI
     ANTHROPIC
     GOOGLE
     MYNEWPROVIDER  // Add here
     OTHER
   }
   ```

2. **Create provider client**
   ```bash
   touch backend/src/services/providers/mynewprovider.client.ts
   ```

3. **Implement ProviderClient interface**
   ```typescript
   export class MyNewProviderClient implements ProviderClient {
     async syncMemory(params: SyncMemoryParams): Promise<SyncResult> {
       // Implementation
     }
   }
   ```

4. **Update ProviderClientFactory**
   ```typescript
   case 'MYNEWPROVIDER':
     const { MyNewProviderClient } = require('./mynewprovider.client');
     this.clients.set(providerType, new MyNewProviderClient());
     break;
   ```

5. **Add to seed file** (optional)

### Adding New API Endpoints

1. **Create route file** (if new resource)
   ```bash
   touch backend/src/routes/resource.routes.ts
   ```

2. **Define routes**
   ```typescript
   export async function resourceRoutes(fastify: FastifyInstance) {
     fastify.get('/', async (request, reply) => {
       // Handler
     });
   }
   ```

3. **Register in server**
   ```typescript
   // In backend/src/index.ts
   fastify.register(resourceRoutes, { prefix: '/api/resource' });
   ```

4. **Update API client**
   ```typescript
   // In frontend/src/lib/api.ts
   async getResource(): Promise<Resource> {
     return this.fetchJson<Resource>('/api/resource');
   }
   ```

### Adding New UI Pages

1. **Create page component**
   ```bash
   mkdir -p frontend/src/app/mypage
   touch frontend/src/app/mypage/page.tsx
   ```

2. **Implement page**
   ```typescript
   'use client';

   export default function MyPage() {
     // Implementation
   }
   ```

3. **Add to navigation**
   ```typescript
   // Update navigation in app/page.tsx, etc.
   <Link href="/mypage">My Page</Link>
   ```

## Testing

Currently, the project uses manual testing. When adding tests:

1. **Backend tests**: Consider using Jest or Vitest
2. **Frontend tests**: Consider using React Testing Library
3. **E2E tests**: Consider using Playwright

Test coverage goals:
- Critical business logic
- API endpoints
- Sync state machine
- Provider clients

## Documentation

Update documentation when:
- Adding new features
- Changing API contracts
- Modifying database schema
- Adding configuration options

Files to update:
- `README.md` - Main documentation
- `CONTRIBUTING.md` - This file
- Code comments - For complex logic
- API documentation - For new endpoints

## Performance Considerations

- **Database queries**: Use indexes, avoid N+1 queries
- **Sync batching**: Adjust batch size for performance
- **API responses**: Consider pagination for large datasets
- **Real-time updates**: Consider WebSocket for live sync status

## Security Considerations

- **API keys**: Never commit real API keys
- **Input validation**: Use Zod schemas for all inputs
- **SQL injection**: Use Prisma's parameterized queries
- **Authentication**: Add authentication before production use

## Questions or Issues?

- Open an issue on GitHub
- Discuss in pull request comments
- Check existing issues and documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
